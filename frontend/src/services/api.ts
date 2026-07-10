let BASE_URL = "http://127.0.0.1:8000";

if (typeof window !== "undefined") {
  BASE_URL = "";
}

export default BASE_URL;
