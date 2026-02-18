/**
 * useAlert — Imperative hook for themed alerts and toasts.
 *
 * Returns `{ alert, confirm, toast, AlertComponent }`.
 * - `alert(title, message?, variant?)` — modal dialog with OK button
 * - `confirm(title, message, onConfirm, options?)` — modal dialog with Cancel + OK
 * - `toast(title, message?, variant?)` — centered boxy auto-dismiss popup (no tap needed)
 * - `AlertComponent` — JSX element to render in your component tree: {AlertComponent}
 *
 * Usage:
 *   const { alert, confirm, toast, AlertComponent } = useAlert();
 *   toast('Sync Complete', '3 new emails', 'success');
 *   // In JSX: {AlertComponent}
 */
import React, { useState, useCallback } from 'react';
import { ThemedAlert, AlertVariant, AlertButton } from '../components/common/ThemedAlert';
import { ThemedToast, ToastVariant } from '../components/common/ThemedToast';

interface AlertState {
  visible: boolean;
  title: string;
  message?: string;
  variant: AlertVariant;
  buttons: AlertButton[];
}

interface ToastState {
  visible: boolean;
  title: string;
  message?: string;
  variant: ToastVariant;
}

const INITIAL_ALERT: AlertState = {
  visible: false,
  title: '',
  message: undefined,
  variant: 'info',
  buttons: [],
};

const INITIAL_TOAST: ToastState = {
  visible: false,
  title: '',
  message: undefined,
  variant: 'info',
};

export function useAlert() {
  const [alertState, setAlertState] = useState<AlertState>(INITIAL_ALERT);
  const [toastState, setToastState] = useState<ToastState>(INITIAL_TOAST);

  const dismissAlert = useCallback(() => {
    setAlertState(INITIAL_ALERT);
  }, []);

  const dismissToast = useCallback(() => {
    setToastState(INITIAL_TOAST);
  }, []);

  const alert = useCallback(
    (
      title: string,
      message?: string,
      variant: AlertVariant = 'info',
      onDismiss?: () => void,
    ) => {
      setAlertState({
        visible: true,
        title,
        message,
        variant,
        buttons: [
          {
            text: 'OK',
            style: 'default',
            onPress: onDismiss,
          },
        ],
      });
    },
    [],
  );

  const confirm = useCallback(
    (
      title: string,
      message: string,
      onConfirm: () => void,
      options?: {
        confirmText?: string;
        cancelText?: string;
        variant?: AlertVariant;
        destructive?: boolean;
      },
    ) => {
      setAlertState({
        visible: true,
        title,
        message,
        variant: options?.variant ?? 'confirm',
        buttons: [
          {
            text: options?.cancelText ?? 'Cancel',
            style: 'cancel',
          },
          {
            text: options?.confirmText ?? 'OK',
            style: options?.destructive ? 'destructive' : 'default',
            onPress: onConfirm,
          },
        ],
      });
    },
    [],
  );

  const toast = useCallback(
    (title: string, message?: string, variant: ToastVariant = 'info') => {
      setToastState({ visible: true, title, message, variant });
    },
    [],
  );

  const AlertComponent = (
    <>
      <ThemedAlert
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        variant={alertState.variant}
        buttons={alertState.buttons}
        onDismiss={dismissAlert}
      />
      <ThemedToast
        visible={toastState.visible}
        title={toastState.title}
        message={toastState.message}
        variant={toastState.variant}
        onHide={dismissToast}
      />
    </>
  );

  return { alert, confirm, toast, AlertComponent };
}
