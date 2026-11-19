import { useEffect, type ReactNode } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    GlobalStyles,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material';
import dayjs from 'dayjs';
import { DetailSkeleton, EmptyState, ErrorState, LogoMark } from '@/components/ui';
import { PrintIcon, ReceiptIcon } from '@/components/ui/icons';
import { useSession } from '@/features/auth/useSession';
import { DISPLAY_STATUS, EARNING_STATUS, REFUND_STATUS, metaFor } from '@/features/ops/model';
import { usePageCrumb } from '@/features/shell/crumbContext';
import { errorStatus, getErrorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useUrlState } from '@/lib/hooks';
import { cents, formatMoney } from '@/lib/money';
import { color, font, hairline, radius } from '@/theme/tokens';
import { useGetBookingQuery, type BookingDetail } from './api';

// Printing: everything but the sheet is hidden, the sheet fills the page, and the browser's own
// header and footer get a quiet margin. "Save as PDF" in the print dialog gives the PDF.
const printStyles = (
    <GlobalStyles
        styles={{
            '@media print': {
                '@page': { size: 'A4', margin: '14mm' },
                'html, body': { background: '#FFFFFF !important' },
                'body *': { visibility: 'hidden' },
                '.receipt-sheet, .receipt-sheet *': { visibility: 'visible' },
                '.receipt-sheet': {
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: '100%',
                    border: '0 !important',
                    padding: '0 !important',
                    margin: '0 !important',
                    boxShadow: 'none !important',
                },
                '.receipt-no-print': { display: 'none !important' },
            },
        }}
    />
);

function Row({
    label,
    value,
    strong,
    muted,
    hint,
}: {
    label: ReactNode;
    value: ReactNode;
    strong?: boolean;
    muted?: boolean;
    hint?: ReactNode;
}) {
    return (
        <Box
            component="tr"
            sx={{
                '& td': {
                    py: strong ? 1.25 : 0.9,
                    borderTop: strong ? `2px solid ${color.ink900}` : hairline,
                    verticalAlign: 'top',
                    fontSize: strong ? font.size.lg : font.size.md,
                    fontWeight: strong ? 800 : 600,
                    color: muted ? color.ink600 : color.ink900,
                },
            }}
        >
            <td>
                {label}
                {hint && (
                    <Box
                        sx={{
                            fontSize: font.size.xs,
                            fontWeight: 600,
                            color: color.ink500,
                            mt: 0.25,
                        }}
                    >
                        {hint}
                    </Box>
                )}
            </td>
            <Box
                component="td"
                sx={{
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                    pl: 2,
                }}
            >
                {value}
            </Box>
        </Box>
    );
}

function Party({ label, lines }: { label: string; lines: (string | null | undefined)[] }) {
    return (
        <Box sx={{ minWidth: 0 }}>
            <Box sx={{ fontSize: font.size.xs, fontWeight: 700, color: color.ink500, mb: 0.5 }}>
                {label}
            </Box>
            {lines.filter(Boolean).map((l, i) => (
                <Box
                    key={i}
                    sx={{
                        fontSize: font.size.md,
                        fontWeight: i === 0 ? 700 : 500,
                        color: i === 0 ? color.ink900 : color.ink600,
                        overflowWrap: 'anywhere',
                    }}
                >
                    {l}
                </Box>
            ))}
        </Box>
    );
}

type Copy = 'customer' | 'provider';

function Sheet({ d, copy }: { d: BookingDetail; copy: Copy }) {
    const b = d.booking;
    const paid = d.payments.find((p) => p.status === 'completed') ?? null;
    const earning = d.earnings[0] ?? null;
    const end = b.scheduledEnd ?? dayjs(b.startDate).add(b.hours, 'hour').toISOString();
    const refunded = paid?.refund?.totalRefunded ?? 0;
    const status = metaFor(DISPLAY_STATUS, b.displayStatus).label;
    const fee =
        earning?.amount !== undefined
            ? cents(b.amount - earning.amount)
            : (paid?.platformFee ?? null);
    const issued =
        copy === 'customer'
            ? (paid?.paidAt ?? paid?.createdAt ?? b.createdAt)
            : (earning?.createdAt ?? b.completedAt ?? b.createdAt);

    return (
        <Box
            component="article"
            className="receipt-sheet"
            aria-label={`${copy === 'customer' ? 'Customer' : 'Provider'} receipt ${b.reference}`}
            sx={{
                bgcolor: color.surface,
                border: hairline,
                borderRadius: `${radius.md}px`,
                maxWidth: 760,
                mx: 'auto',
                px: { xs: 2.5, sm: 6 },
                py: { xs: 3, sm: 5.5 },
                color: color.ink900,
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 2,
                    flexWrap: 'wrap',
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                    <LogoMark size={34} />
                    <Box
                        sx={{
                            fontWeight: 800,
                            fontSize: font.size.xl,
                            letterSpacing: font.tracking.head,
                        }}
                    >
                        HelpHive
                    </Box>
                </Box>
                <Box sx={{ textAlign: { sm: 'right' } }}>
                    <Box
                        sx={{
                            fontSize: font.size['2xl'],
                            fontWeight: 800,
                            letterSpacing: font.tracking.head,
                        }}
                    >
                        {copy === 'customer' ? 'Receipt' : 'Earnings statement'}
                    </Box>
                    <Box
                        sx={{
                            fontSize: font.size.md,
                            fontWeight: 700,
                            fontVariantNumeric: 'tabular-nums',
                        }}
                    >
                        {b.reference}
                    </Box>
                    <Box sx={{ fontSize: font.size.sm, color: color.ink600, fontWeight: 600 }}>
                        Issued {formatDateTime(issued)}
                    </Box>
                </Box>
            </Box>

            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    gap: 3,
                    mt: 4,
                    pt: 3,
                    borderTop: hairline,
                }}
            >
                {copy === 'customer' ? (
                    <>
                        <Party
                            label="Billed to"
                            lines={[d.customer?.name, d.customer?.email, d.customer?.phone]}
                        />
                        <Party
                            label="Worked by"
                            lines={
                                d.provider
                                    ? [d.provider.name, 'HelpHive provider']
                                    : ['No provider assigned']
                            }
                        />
                    </>
                ) : (
                    <>
                        <Party
                            label="Paid to"
                            lines={[d.provider?.name ?? 'No provider assigned', d.provider?.email]}
                        />
                        <Party label="Customer" lines={[d.customer?.name]} />
                    </>
                )}
            </Box>

            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', mt: 4 }}>
                <thead>
                    <tr>
                        <Box
                            component="th"
                            sx={{
                                textAlign: 'left',
                                fontSize: font.size.xs,
                                fontWeight: 700,
                                color: color.ink500,
                                pb: 0.75,
                            }}
                        >
                            Description
                        </Box>
                        <Box
                            component="th"
                            sx={{
                                textAlign: 'right',
                                fontSize: font.size.xs,
                                fontWeight: 700,
                                color: color.ink500,
                                pb: 0.75,
                            }}
                        >
                            Amount
                        </Box>
                    </tr>
                </thead>
                <tbody>
                    <Row
                        label={`${b.service?.name ?? 'Shift'}, ${b.hours} h at ${formatMoney(b.rate)} an hour`}
                        hint={
                            <>
                                {dayjs(b.startDate).format('ddd D MMM YYYY, HH:mm')} to{' '}
                                {dayjs(end).format('HH:mm')}
                                {b.address ? `, ${b.address}` : ''}. Booking {status.toLowerCase()}.
                            </>
                        }
                        value={formatMoney(b.amount)}
                    />
                    {copy === 'customer' ? (
                        <>
                            <Row
                                label="Paid"
                                hint={
                                    paid
                                        ? `${paid.refund?.destinationType ? `By ${paid.refund.destinationType}, ` : ''}${paid.paidAt ? formatDateTime(paid.paidAt) : 'payment date not recorded'}`
                                        : 'Not paid'
                                }
                                value={formatMoney(paid?.amount ?? 0)}
                                muted
                            />
                            {refunded > 0 && (
                                <Row
                                    label="Refunded"
                                    hint={`${metaFor(REFUND_STATUS, paid?.refund?.status).label}${paid?.refund?.refundedAt ? `, ${formatDateTime(paid.refund.refundedAt)}` : ''}. Back to the original payment method.`}
                                    value={`-${formatMoney(refunded)}`}
                                    muted
                                />
                            )}
                            <Row
                                label="Total paid"
                                value={formatMoney(cents((paid?.amount ?? 0) - refunded))}
                                strong
                            />
                        </>
                    ) : (
                        <>
                            <Row
                                label="HelpHive platform fee"
                                hint="5 % of the booking"
                                value={fee === null ? '—' : `-${formatMoney(fee)}`}
                                muted
                            />
                            <Row
                                label="Your earning"
                                hint={
                                    earning
                                        ? `${metaFor(EARNING_STATUS, earning.status).label}${earning.releasedAt ? ` to your Stripe account ${formatDateTime(earning.releasedAt)}` : ''}`
                                        : 'No earning: an earning is created when the booking is completed.'
                                }
                                value={formatMoney(earning?.amount ?? 0)}
                                strong
                            />
                        </>
                    )}
                </tbody>
            </Box>

            <Box
                sx={{
                    mt: 4,
                    pt: 2,
                    borderTop: hairline,
                    fontSize: font.size.xs,
                    color: color.ink500,
                    fontWeight: 500,
                    lineHeight: 1.6,
                }}
            >
                {copy === 'customer'
                    ? 'Amounts in US dollars. Payment processed by Stripe on behalf of HelpHive.'
                    : 'Amounts in US dollars. Earnings are released to your Stripe account and paid out from there.'}{' '}
                Questions about this {copy === 'customer' ? 'receipt' : 'statement'}: quote{' '}
                <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
                    {b.reference}
                </Box>
                .
            </Box>
        </Box>
    );
}

/**
 * A receipt for any booking: the customer copy (what they paid and got back) and the provider
 * copy (booking value, platform fee, earning). Printable, and saved as PDF from the print dialog.
 */
export default function ReceiptPage() {
    const { bookingId = '' } = useParams();
    const [{ copy }, setUrl] = useUrlState({ copy: 'customer' });
    const { demo } = useSession();
    const res = useGetBookingQuery(bookingId);
    const d = res.data;
    const which: Copy = copy === 'provider' ? 'provider' : 'customer';
    usePageCrumb(d ? `Receipt ${d.booking.reference}` : 'Receipt');

    // The PDF file name follows the document title.
    useEffect(() => {
        if (!d) return;
        const previous = document.title;
        document.title = `HelpHive ${which === 'customer' ? 'receipt' : 'earnings statement'} ${d.booking.reference}`;
        return () => {
            document.title = previous;
        };
    }, [d, which]);

    if (res.isLoading) return <DetailSkeleton label="Loading the receipt" />;
    if (!d) {
        const notFound = errorStatus(res.error) === 404 || errorStatus(res.error) === 400;
        return notFound ? (
            <EmptyState icon={<ReceiptIcon />} title="This booking was not found" />
        ) : (
            <ErrorState
                title="Could not load the receipt"
                message={getErrorMessage(res.error, 'The API did not answer.')}
                onRetry={res.refetch}
                retrying={res.isFetching}
            />
        );
    }
    const paid = d.payments.some((p) => p.status === 'completed');

    return (
        <>
            {printStyles}
            <Box
                className="receipt-no-print"
                sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1.5,
                    mb: 2.5,
                }}
            >
                <Box>
                    <Typography variant="h3" component="h1">
                        Receipt {d.booking.reference}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        The customer and the provider see different figures; choose a copy, then
                        print it or save it as a PDF from the print dialog.
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <ToggleButtonGroup
                        exclusive
                        size="small"
                        value={which}
                        onChange={(_, v: Copy | null) => v && setUrl({ copy: v })}
                        aria-label="Copy"
                        sx={{ bgcolor: color.surface }}
                    >
                        <ToggleButton value="customer" sx={{ px: 1.75 }}>
                            Customer copy
                        </ToggleButton>
                        <ToggleButton value="provider" sx={{ px: 1.75 }} disabled={!d.provider}>
                            Provider copy
                        </ToggleButton>
                    </ToggleButtonGroup>
                    <Button
                        variant="contained"
                        startIcon={<PrintIcon />}
                        onClick={() => window.print()}
                    >
                        Print or save as PDF
                    </Button>
                    <Button
                        component={RouterLink}
                        to={`/bookings/${d.booking._id}`}
                        variant="outlined"
                    >
                        Open booking
                    </Button>
                </Box>
            </Box>
            {(!paid && which === 'customer') || demo ? (
                <Box
                    className="receipt-no-print"
                    sx={{ maxWidth: 760, mx: 'auto', mb: 2, display: 'grid', gap: 1 }}
                >
                    {!paid && which === 'customer' && (
                        <Alert severity="warning">
                            This booking was never paid, so this sheet records no payment.
                        </Alert>
                    )}
                    {demo && (
                        <Alert severity="info">
                            Demo: names, emails and the address are masked exactly as the API sends
                            them.
                        </Alert>
                    )}
                </Box>
            ) : null}
            <Sheet d={d} copy={which} />
        </>
    );
}
