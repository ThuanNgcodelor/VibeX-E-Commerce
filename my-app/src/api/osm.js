import axios from "axios";

// Reverse geocode bằng OpenStreetMap (Nominatim)
export const reverseGeocodeOSM = async (lat, lon) => {
    const res = await axios.get(
        "https://nominatim.openstreetmap.org/reverse",
        {
            params: {
                format: "jsonv2",
                lat,
                lon,
                zoom: 18,
                addressdetails: 1,
            },
            headers: {
                "Accept-Language": "vi",
            },
        }
    );

    return res.data;
};
