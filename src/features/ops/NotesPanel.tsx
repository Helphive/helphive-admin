import { useState } from 'react';
import { Alert, Box, Button, CircularProgress, TextField } from '@mui/material';
import { EmptyState, Panel, ReasonDialog } from '@/components/ui';
import { NoteIcon } from '@/components/ui/icons';
import { useToast } from '@/components/feedback/toastContext';
import GatedButton from '@/features/auth/GatedButton';
import { useActionGate, useSession } from '@/features/auth/useSession';
import { getErrorMessage } from '@/lib/api';
import { formatAgo, formatDateTime } from '@/lib/format';
import { useNow } from '@/lib/hooks';
import { color, font, hairline } from '@/theme/tokens';
import {
    useCreateNoteMutation,
    useDeleteNoteMutation,
    useUpdateNoteMutation,
    type NoteTarget,
} from './api';
import type { AdminNote } from './model';

const MAX = 2000;

function NoteRow({
    note,
    target,
    targetId,
}: {
    note: AdminNote;
    target: NoteTarget;
    targetId: string;
}) {
    const now = useNow();
    const toast = useToast();
    const { admin } = useSession();
    const gate = useActionGate('notes.manage');
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState(note.body);
    const [error, setError] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [update, updateState] = useUpdateNoteMutation();
    const [remove] = useDeleteNoteMutation();
    const mine = admin?._id && note.author?.id === admin._id;

    const save = async () => {
        setError(null);
        const body = text.trim();
        if (!body) return setError('A note cannot be empty. Delete it instead.');
        try {
            await update({ id: note._id, body, target, targetId }).unwrap();
            toast.success('Saved the note');
            setEditing(false);
        } catch (err) {
            setError(getErrorMessage(err, 'The note was not saved. Try again.'));
        }
    };

    return (
        <Box
            component="li"
            sx={{ px: { xs: 2, sm: 2.5 }, py: 1.5, '& + &': { borderTop: hairline } }}
        >
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 1,
                    fontSize: font.size.xs,
                    fontWeight: 600,
                    color: color.ink500,
                    mb: 0.5,
                }}
            >
                <span>
                    {note.author?.email ?? 'Unknown admin'}
                    {mine ? ' (you)' : ''}
                </span>
                <span title={formatDateTime(note.createdAt)}>
                    {formatAgo(note.createdAt, now)}
                    {note.editedAt ? ', edited' : ''}
                </span>
            </Box>
            {editing ? (
                <Box sx={{ display: 'grid', gap: 1 }}>
                    <TextField
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        multiline
                        minRows={2}
                        fullWidth
                        autoFocus
                        inputProps={{ maxLength: MAX, 'aria-label': 'Note text' }}
                    />
                    {error && (
                        <Alert severity="error" role="alert">
                            {error}
                        </Alert>
                    )}
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                                setEditing(false);
                                setText(note.body);
                                setError(null);
                            }}
                            disabled={updateState.isLoading}
                        >
                            Go back
                        </Button>
                        <Button
                            size="small"
                            variant="contained"
                            onClick={save}
                            disabled={updateState.isLoading || text.trim() === note.body}
                            startIcon={
                                updateState.isLoading ? <CircularProgress size={14} /> : undefined
                            }
                        >
                            Save note
                        </Button>
                    </Box>
                </Box>
            ) : (
                <Box
                    sx={{
                        fontSize: font.size.md,
                        color: color.ink900,
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'anywhere',
                    }}
                >
                    {note.body}
                </Box>
            )}
            {!editing && (
                <Box sx={{ display: 'flex', gap: 0.5, mt: 0.75 }}>
                    <GatedButton
                        permission="notes.manage"
                        size="small"
                        onClick={() => setEditing(true)}
                        sx={{ minHeight: 28, px: 1 }}
                    >
                        Edit
                    </GatedButton>
                    <GatedButton
                        permission="notes.manage"
                        size="small"
                        color="error"
                        onClick={() => setDeleting(true)}
                        sx={{ minHeight: 28, px: 1 }}
                    >
                        Delete
                    </GatedButton>
                </Box>
            )}
            {deleting && gate.allowed && (
                <ReasonDialog
                    title="Delete this note?"
                    effect="It disappears from the record; the audit log keeps its text."
                    reason="required"
                    destructive
                    confirmLabel="Delete note"
                    busyLabel="Deleting"
                    onConfirm={async (reason) => {
                        await remove({ id: note._id, reason, target, targetId }).unwrap();
                        toast.success('Deleted the note');
                        setDeleting(false);
                    }}
                    onClose={() => setDeleting(false)}
                />
            )}
        </Box>
    );
}

/**
 * Internal notes on a record, newest first. Never shown to customers or providers. Adding,
 * editing and deleting need notes.manage; the API lets only the author or a super admin change one.
 */
export default function NotesPanel({
    target,
    targetId,
    notes,
}: {
    target: NoteTarget;
    targetId: string;
    notes: AdminNote[];
}) {
    const toast = useToast();
    const gate = useActionGate('notes.manage');
    const [text, setText] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [create, createState] = useCreateNoteMutation();

    const add = async () => {
        setError(null);
        const body = text.trim();
        if (!body) return setError('Write the note first.');
        try {
            await create({ targetType: target, targetId, body }).unwrap();
            setText('');
            toast.success('Added the note');
        } catch (err) {
            setError(getErrorMessage(err, 'The note was not added. Try again.'));
        }
    };

    return (
        <Panel
            title="Notes"
            subtitle="For admins only; customers and providers never see them."
            flush
        >
            <Box sx={{ p: { xs: 2, sm: 2.5 }, borderBottom: notes.length ? hairline : 0 }}>
                <TextField
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={gate.allowed ? 'Add a note for other admins' : (gate.reason ?? '')}
                    multiline
                    minRows={2}
                    fullWidth
                    disabled={!gate.allowed}
                    inputProps={{ maxLength: MAX, 'aria-label': 'New note' }}
                    helperText={
                        gate.allowed && text.length > MAX - 200
                            ? `${MAX - text.length} characters left`
                            : undefined
                    }
                />
                {error && (
                    <Alert severity="error" role="alert" sx={{ mt: 1 }}>
                        {error}
                    </Alert>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                    <GatedButton
                        permission="notes.manage"
                        variant="outlined"
                        size="small"
                        onClick={add}
                        disabled={createState.isLoading || !text.trim()}
                        startIcon={
                            createState.isLoading ? <CircularProgress size={14} /> : <NoteIcon />
                        }
                    >
                        Add note
                    </GatedButton>
                </Box>
            </Box>
            {notes.length ? (
                <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }} aria-label="Notes">
                    {notes.map((n) => (
                        <NoteRow key={n._id} note={n} target={target} targetId={targetId} />
                    ))}
                </Box>
            ) : (
                <EmptyState
                    bare
                    icon={<NoteIcon />}
                    title="No notes yet"
                    description="Notes record context the data does not: a phone call, a promise, a warning."
                    sx={{ py: { xs: 3, sm: 3 } }}
                />
            )}
        </Panel>
    );
}
