import axios from "axios";

const axiosServices = axios.create({ baseURL: import.meta.env.VITE_APP_API_URL || "http://localhost:8080/" });

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
