import React, { useState, useEffect } from "react";
import {
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	Button,
	TextField,
	MenuItem,
	Select,
	FormControl,
	InputLabel,
	Stack,
	Typography,
	Chip,
	Avatar,
	Divider,
	Box,
	Snackbar,
	useTheme,
} from "@mui/material";

const rejectionReasons = ["Insufficient Experience", "Invalid Credentials", "Other"];

const ReviewProviderApplication = ({ application, onClose, onApprove, onReject, isLoading, error }) => {
	const [open, setOpen] = useState(true);
	const [rejectionReason, setRejectionReason] = useState("");
	const [customReason, setCustomReason] = useState("");
	const [loadingButton, setLoadingButton] = useState(null);
	const [localError, setLocalError] = useState(error);
	const [snackbarOpen, setSnackbarOpen] = useState(false);
	const theme = useTheme();

	useEffect(() => {
		if (error) {
			setLocalError(error);
			setSnackbarOpen(true);
		}
	}, [error]);

	const handleClose = () => {
		setOpen(false);
		onClose();
	};

	const handleApprove = () => {
		if (loadingButton) return;
		setLoadingButton("approve");
		setLocalError(null);
		onApprove(application._id);
	};

	const handleReject = () => {
		if (loadingButton) return;
		if (!rejectionReason) {
			setLocalError("Please select a rejection reason.");
			setSnackbarOpen(true);
			return;
		}
		if (rejectionReason === "Other" && !customReason) {
			setLocalError("Please provide a custom rejection reason.");
			setSnackbarOpen(true);
			return;
		}
		const reason = rejectionReason === "Other" ? customReason : rejectionReason;
		setLoadingButton("reject");
		setLocalError(null);
		onReject(application._id, reason);
	};

	const handleSnackbarClose = () => {
		setSnackbarOpen(false);
	};

	return (
		<Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
			<DialogTitle>Review Provider Application</DialogTitle>
			<DialogContent>
				<Stack spacing={3}>
					<Stack direction="row" spacing={2} alignItems="center">
						<Avatar
							alt={application.firstName}
							sx={{ width: 56, height: 56 }}
							variant="rounded"
							src={application.profile}
						/>
						<Stack spacing={0.5}>
							<Typography variant="h6">{`${application.firstName} ${application.lastName}`}</Typography>
							<Typography variant="body2" color="text.secondary">
								{application.email}
							</Typography>
						</Stack>
					</Stack>
					<Divider />
					<Box>
						<Typography variant="body1">
							<strong>City:</strong> {application.city}
						</Typography>
						<Typography variant="body1">
							<strong>Country:</strong> {application.country}
						</Typography>
						<Typography variant="body1">
							<strong>Phone:</strong> {application.phone}
						</Typography>
					</Box>
					<Stack direction="row" spacing={2} mt={2}>
						<Button
							variant="outlined"
							size="small"
							href={application.resume}
							target="_blank"
							rel="noopener"
							disabled={isLoading}
						>
							Resume
						</Button>
						<Button
							variant="outlined"
							size="small"
							href={application.id}
							target="_blank"
							rel="noopener"
							disabled={isLoading}
						>
							ID
						</Button>
						<Button
							variant="outlined"
							size="small"
							href={application.dbs}
							target="_blank"
							rel="noopener"
							disabled={isLoading}
						>
							DBS
						</Button>
					</Stack>
					<Divider />
					<Typography variant="body1">
						<strong>Status:</strong>
						{application.status === "approved" && (
							<Chip color="success" label="Approved" size="small" sx={{ borderRadius: 1, ml: 1 }} />
						)}
						{application.status === "rejected" && (
							<Chip color="error" label="Rejected" size="small" sx={{ borderRadius: 1, ml: 1 }} />
						)}
						{application.status === "pending" && (
							<Chip color="warning" label="Pending" size="small" sx={{ borderRadius: 1, ml: 1 }} />
						)}
					</Typography>
					{rejectionReason === "Other" && (
						<TextField
							label="Custom Reason"
							variant="outlined"
							fullWidth
							value={customReason}
							onChange={(e) => setCustomReason(e.target.value)}
							sx={{ mt: 2 }}
							disabled={isLoading}
						/>
					)}
				</Stack>
			</DialogContent>
			<DialogActions sx={{ justifyContent: "space-between", p: 3 }}>
				<Button
					onClick={handleApprove}
					color="primary"
					variant="contained"
					isLoading={isLoading || loadingButton === "reject"}
					disabled={isLoading || loadingButton === "reject" || loadingButton === "approve"}
				>
					{loadingButton === "approve" && isLoading ? "Approving..." : "Approve"}
				</Button>
				<FormControl variant="outlined" sx={{ minWidth: 200 }}>
					<InputLabel>Rejection Reason</InputLabel>
					<Select
						value={rejectionReason}
						onChange={(e) => setRejectionReason(e.target.value)}
						label="Rejection Reason"
						disabled={isLoading}
					>
						{rejectionReasons.map((reason) => (
							<MenuItem key={reason} value={reason}>
								{reason}
							</MenuItem>
						))}
					</Select>
				</FormControl>
				<Button
					onClick={handleReject}
					color="secondary"
					variant="contained"
					isLoading={isLoading || loadingButton === "approve"}
					disabled={isLoading || loadingButton === "approve" || loadingButton === "reject"}
				>
					{loadingButton === "reject" && isLoading ? "Rejecting..." : "Reject"}
				</Button>
			</DialogActions>
			<Snackbar
				open={snackbarOpen}
				autoHideDuration={6000}
				onClose={handleSnackbarClose}
				message={localError}
				ContentProps={{
					sx: {
						backgroundColor: theme.palette.error.main,
						color: theme.palette.error.contrastText,
					},
				}}
			/>
		</Dialog>
	);
};

export default ReviewProviderApplication;
