// pages/api/places.js
export default async function handler(req, res) {
  try {
    const {
      lat,
      lng,
      radius = "2000",
      types = "",
      openNow = "false",
    } = req.query;
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey)
      return res
        .status(500)
        .json({ error: "Server missing GOOGLE_PLACES_API_KEY" });
    if (!lat || !lng)
      return res.status(400).json({ error: "lat and lng are required" });

    const splitTypes = (types || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const wantOpen = String(openNow).toLowerCase() === "true";
    const unique = new Map();

    async function fetchType(type) {
      const url = new URL(
        "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
      );
      url.searchParams.set("location", `${lat},${lng}`);
      url.searchParams.set("radius", radius);
      url.searchParams.set("type", type);
      if (wantOpen) url.searchParams.set("opennow", "true");
      url.searchParams.set("key", apiKey);

      const r = await fetch(url.toString());
      const data = await r.json();

      if (data && Array.isArray(data.results)) {
        data.results.forEach((place) => {
          if (!place.place_id) return;
          if (!unique.has(place.place_id)) {
            unique.set(place.place_id, {
              place_id: place.place_id,
              name: place.name,
              rating: place.rating ?? null,
              user_ratings_total: place.user_ratings_total ?? 0,
              price_level: place.price_level ?? null,
              address: place.vicinity ?? place.formatted_address ?? "",
              location: place.geometry?.location ?? null,
              types: place.types ?? [],
              open_now: place.opening_hours?.open_now ?? null,
              photo_ref: place.photos?.[0]?.photo_reference ?? null,
            });
          }
        });
      }
    }

    const toQuery = splitTypes.length
      ? splitTypes
      : [
          "restaurant",
          "cafe",
          "bakery",
          "bar",
          "meal_takeaway",
          "meal_delivery",
          "park",
          "tourist_attraction",
          "bowling_alley",
          "movie_theater",
          "amusement_park",
          "aquarium",
          "art_gallery",
          "book_store",
          "shopping_mall",
          "museum",
        ];

    const batchSize = 4;
    for (let i = 0; i < toQuery.length; i += batchSize) {
      const slice = toQuery.slice(i, i + batchSize);
      await Promise.all(slice.map(fetchType));
    }

    const results = Array.from(unique.values())
      .sort((a, b) => {
        const rA = a.rating ?? 0,
          rB = b.rating ?? 0;
        if (rB !== rA) return rB - rA;
        return (b.user_ratings_total ?? 0) - (a.user_ratings_total ?? 0);
      })
      .slice(0, 60);

    res.status(200).json({ count: results.length, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
}
