// material-ui
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import axiosServices from "utils/axios";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import { useTheme } from "@mui/material/styles";

// project-imports
import MainCard from "components/MainCard";
import ProviderApplicationsTable from "sections/provider-applications/ProviderApplicationsTable";
import ReviewProviderApplication from "sections/provider-applications/provider-forms/ReviewProviderApplication";

// ==============================|| PROVIDER APPLICATIONS PAGE ||============================== //

export default function PendingApplicationsPage() {
	const [applications, setApplications] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState(null);
	const [selectedApplication, setSelectedApplication] = useState(null);
	const [actionLoading, setActionLoading] = useState(false);
	const [actionError, setActionError] = useState(null);
	const [successMessage, setSuccessMessage] = useState(null);
	const theme = useTheme();

	const fetchApplications = () => {
		axiosServices
			.get("/admin/provider-account-requests")
			.then((response) => {
				setApplications(response.data);
				setIsLoading(false);
			})
			.catch((error) => {
				setError("Error fetching provider applications");
				setIsLoading(false);
				console.log(error);
			});
	};

	useEffect(() => {
		fetchApplications();
	}, []);

	const handleRowClick = (application) => {
		setSelectedApplication(application);
	};

	const handleCloseReview = () => {
		setSelectedApplication(null);
		setActionError(null);
	};

	const handleApprove = (id) => {
		setActionLoading(true);
		axiosServices
			.post("/admin/update-provider-account-request-status", {
				providerAccountRequestId: id,
				status: "approved",
				message: "",
			})
			.then(() => {
				setActionLoading(false);
				setSuccessMessage("Provider application approved successfully");
				fetchApplications(); // Refetch updated data
			})
			.catch((error) => {
				console.log(error);
				setActionError("Error approving provider application");
				setActionLoading(false);
			});
	};

	const handleReject = (id, reason) => {
		setActionLoading(true);
		axiosServices
			.post("/admin/update-provider-account-request-status", {
				providerAccountRequestId: id,
				status: "rejected",
				message: reason,
			})
			.then(() => {
				setActionLoading(false);
				setSuccessMessage("Provider application rejected successfully");
				fetchApplications(); // Refetch updated data
			})
			.catch((error) => {
				console.log(error);
				setActionError("Error rejecting provider application");
				setActionLoading(false);
			});
	};

	const handleCloseSnackbar = () => {
		setSuccessMessage(null);
	};

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
			{!isLoading && !error && (
				<ProviderApplicationsTable applications={applications} handleRowClick={handleRowClick} />
			)}
			{selectedApplication && (
				<ReviewProviderApplication
					application={selectedApplication}
					onClose={handleCloseReview}
					onApprove={handleApprove}
					onReject={handleReject}
					isLoading={actionLoading}
					error={actionError}
				/>
			)}
			<Snackbar
				open={!!successMessage}
				autoHideDuration={6000}
				onClose={handleCloseSnackbar}
				message={successMessage}
				ContentProps={{
					sx: {
						backgroundColor: theme.palette.success.main,
						color: theme.palette.success.contrastText,
					},
				}}
			/>
		</MainCard>
	);
}
