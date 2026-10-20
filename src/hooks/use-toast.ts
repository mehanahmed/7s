
"use client"

// Inspired by react-hot-toast library
import * as React from "react"

import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"
import { getGlobalSettings } from "@/lib/settings-service"

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 10000 
const DEFAULT_TOAST_SOUND_URL = 'https://audio-previews.elements.envatousercontent.com/files/500391660/preview.mp3';


type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type ActionType = typeof actionTypes

type Action =
  | {
      type: ActionType["ADD_TOAST"]
      toast: ToasterToast
    }
  | {
      type: ActionType["UPDATE_TOAST"]
      toast: Partial<ToasterToast>
    }
  | {
      type: ActionType["DISMISS_TOAST"]
      toastId?: ToasterToast["id"]
    }
  | {
      type: ActionType["REMOVE_TOAST"]
      toastId?: ToasterToast["id"]
    }

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
        })
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      }
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

const listeners: Array<(state: State) => void> = []
const notificationListeners = new Set<(notification: ToasterToast) => void>()

// Keep app alert subscribers independent of visible toast dismissal and limits.
export function subscribeToNotifications(listener: (notification: ToasterToast) => void) {
  notificationListeners.add(listener)
  return () => { notificationListeners.delete(listener) }
}

let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  if (action.type === "ADD_TOAST" || action.type === "UPDATE_TOAST") {
    const notification = memoryState.toasts.find((item) => item.id === action.toast.id)
    if (notification) notificationListeners.forEach((listener) => listener(notification))
  }
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

type Toast = Omit<ToasterToast, "id">

async function playToastSound() {
  if (typeof window === 'undefined') return;

  if (window.location.pathname.startsWith('/track')) {
    console.log("Toast sound: Disabled on tracking page.");
    return;
  }

  try {
    const settings = await getGlobalSettings();
    const soundUrlToPlay = settings.toastSoundUrl ?? DEFAULT_TOAST_SOUND_URL;

    if (soundUrlToPlay && soundUrlToPlay.trim() !== '') {
      console.log(`Toast sound: Attempting to play sound from URL: ${soundUrlToPlay}`);
      const audio = new Audio(soundUrlToPlay);
      audio.play()
        .then(() => console.log("Toast sound: Playback initiated."))
        .catch(error => {
          console.warn("Toast sound: Playback failed.", error, "URL:", soundUrlToPlay);
        });
    } else {
      console.log("Toast sound: No sound URL configured or sound disabled.");
    }
  } catch (error) {
    console.error("Toast sound: Error initializing or playing.", error);
  }
}

function toast({ ...props }: Toast) {
  const id = genId()

  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    })
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  const newToastProps = { ...props };
  if (typeof props.description === 'string') {
    if (props.description.includes("An unexpected response was received from the server") || 
        props.description.toLowerCase().includes("failed to fetch")) {
      newToastProps.title = "Connection Issue";
      newToastProps.description = "Internet Connection Disconnected From Server. Please refresh your browser & try again.";
      newToastProps.variant = "destructive";
    }
  }

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...newToastProps,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  // Auto-dismiss after duration (default: 4000ms)
  const autoDismissDuration = props.duration || 4000;
  if (autoDismissDuration !== Infinity) {
    setTimeout(() => {
      dismiss();
    }, autoDismissDuration);
  }

  playToastSound();

  return {
    id: id,
    dismiss,
    update,
  }
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  }
}

export { useToast, toast }
