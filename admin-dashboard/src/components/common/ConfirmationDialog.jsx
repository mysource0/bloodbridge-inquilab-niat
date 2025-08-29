// src/components/common/ConfirmationDialog.jsx
import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';

/**
 * Reusable confirmation dialog.
 * - Awaits async onConfirm handlers before closing.
 * - Disables buttons while processing to avoid duplicate calls.
 */
const ConfirmationDialog = ({ open, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel' }) => {
  const [processing, setProcessing] = useState(false);

  const handleConfirm = useCallback(async () => {
    if (processing) return;
    setProcessing(true);
    try {
      if (typeof onConfirm === 'function') {
        // Call handler and await if it returns a promise
        const result = onConfirm();
        if (result && typeof result.then === 'function') {
          await result;
        }
      }
    } catch (err) {
      // Log — parent can set error state if needed
      // Avoid swallowing errors silently in prod; you may surface this to UI
      // eslint-disable-next-line no-console
      console.error('ConfirmationDialog onConfirm error:', err);
    } finally {
      setProcessing(false);
      if (typeof onClose === 'function') onClose();
    }
  }, [onConfirm, onClose, processing]);

  return (
    <Dialog
      open={Boolean(open)}
      onClose={() => {
        if (!processing && typeof onClose === 'function') onClose();
      }}
      aria-labelledby="confirmation-dialog-title"
      aria-describedby="confirmation-dialog-description"
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle id="confirmation-dialog-title">{title}</DialogTitle>
      <DialogContent>
        <DialogContentText id="confirmation-dialog-description">
          {message}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => { if (!processing && typeof onClose === 'function') onClose(); }} disabled={processing}>
          {cancelText}
        </Button>

        <Button
          onClick={handleConfirm}
          color="primary"
          variant="contained"
          autoFocus
          disabled={processing}
        >
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

ConfirmationDialog.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  onConfirm: PropTypes.func,
  title: PropTypes.string,
  message: PropTypes.string,
  confirmText: PropTypes.string,
  cancelText: PropTypes.string,
};

ConfirmationDialog.defaultProps = {
  open: false,
  onClose: () => {},
  onConfirm: null,
  title: 'Confirm',
  message: '',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
};

export default React.memo(ConfirmationDialog);
