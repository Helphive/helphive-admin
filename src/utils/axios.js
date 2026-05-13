import axios from "axios";

const API_URL =
	import.meta.env.VITE_APP_API_URL ||
	(import.meta.env.DEV ? "http://localhost:8080" : "https://api.helphive.projects.himaiz.com");

const axiosServices = axios.create({
	baseURL: API_URL,
	withCredentials: true,
});

// ==============================|| AXIOS - FOR MOCK SERVICES ||============================== //

axiosServices.interceptors.request.use(
	async (config) => {
		const serviceToken = localStorage.getItem("serviceToken");
		if (serviceToken) {
			config.headers["Authorization"] = `Bearer ${serviceToken}`;
		}
		return config;
	},
	(error) => {
		return Promise.reject(error);
	},
);

axiosServices.interceptors.response.use(
	(response) => response,
	(error) => {
		if (
			(error.response.status === 401 || error.response.status === 403) &&
			!window.location.href.includes("/login")
		) {
			window.location.pathname = "/login";
		}
		return Promise.reject((error.response && error.response.data) || "Wrong Services");
	},
);

export default axiosServices;

export const fetcher = async (args) => {
	const [url, config] = Array.isArray(args) ? args : [args];

	const res = await axiosServices.get(url, { ...config });

	return res.data;
};

export const fetcherPost = async (args) => {
	const [url, config] = Array.isArray(args) ? args : [args];

	const res = await axiosServices.post(url, { ...config });

	return res.data;
};
