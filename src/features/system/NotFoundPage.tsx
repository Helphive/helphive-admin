import { Link as RouterLink } from 'react-router-dom';
import { Button } from '@mui/material';
import { EmptyState } from '@/components/ui';
import { SearchIcon } from '@/components/ui/icons';
import { useDocumentTitle } from '@/lib/hooks';

export default function NotFoundPage() {
    useDocumentTitle('Page not found');
    return (
        <EmptyState
            icon={<SearchIcon />}
            title="There is no page at this address"
            description="Check the link, or use search (Ctrl K) to find the page or record you need."
            action={
                <Button variant="contained" component={RouterLink} to="/">
                    Go to overview
                </Button>
            }
        />
    );
}
