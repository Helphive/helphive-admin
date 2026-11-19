import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import { ErrorState } from '@/components/ui';

/** Last-resort error screen for anything the router itself catches (outside the page boundary). */
export default function RouteError() {
    const error = useRouteError();
    const chunkFailed =
        error instanceof Error && /dynamically imported module|Loading chunk/i.test(error.message);
    const title = isRouteErrorResponse(error)
        ? `${error.status} ${error.statusText}`
        : chunkFailed
          ? 'A newer version of the console is available'
          : 'The console ran into a problem';
    if (!isRouteErrorResponse(error)) console.error(error);
    return (
        <Box sx={{ maxWidth: 520, mx: 'auto', mt: { xs: 6, md: 12 }, px: 2 }}>
            <ErrorState
                title={title}
                message={
                    chunkFailed
                        ? 'Reload to get the latest version.'
                        : 'Reload the page. If it keeps happening, go back to the overview.'
                }
                action={
                    <>
                        <Button variant="contained" onClick={() => window.location.reload()}>
                            Reload page
                        </Button>
                        <Button variant="outlined" href="/">
                            Go to overview
                        </Button>
                    </>
                }
            />
        </Box>
    );
}
