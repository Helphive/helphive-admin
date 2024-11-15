// material-ui
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import axiosServices from "utils/axios";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";

// project-imports
import MainCard from "components/MainCard";
import ReviewedApplicationsTable from "sections/provider-applications/ReviewedApplicationsTable";

// ==============================|| PROVIDER APPLICATIONS PAGE ||============================== //

export default function ReviewedApplicationsPage() {
	const [applications, setApplications] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState(null);

	const fetchApplications = () => {
		axiosServices
			.get("/admin/provider-account-requests-complete")
			.then((response) => {
				setApplications(response.data);
				setIsLoading(false);
			})
			.catch((error) => {
				console.log(error);
				setError("Error fetching provider applications");
				setIsLoading(false);
			});
	};

	useEffect(() => {
		fetchApplications();
	}, []);

	return (
		<MainCard title="Provider Applications">
			<Typography variant="body1" gutterBottom>
				Welcome to the Provider Applications page. Here you can manage and review all provider applications.
			</Typography>
			{isLoading && (
				<div
					style={{
						display: "flex",
						justifyContent: "center",
						alignItems: "center",
						height: "100%",
						minHeight: "500px",
					}}
				>
					<CircularProgress />
				</div>
			)}
			{error && <Alert severity="error">Error! Cannot fetch applications right now.</Alert>}
			{!isLoading && !error && <ReviewedApplicationsTable applications={applications} />}
		</MainCard>
	);
}
