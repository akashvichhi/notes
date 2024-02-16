import { toast } from "react-toastify";

const Toast = {
  success: (message: string, id?: string) => {
    toast.success(message, {
      toastId: id,
    });
  },
  error: (message: string, id?: string) => {
    toast.error(message, {
      toastId: id,
    });
  },
  warning: (message: string, id?: string) => {
    toast.warn(message, {
      toastId: id,
    });
  },
  info: (message: string, id?: string) => {
    toast.info(message, {
      toastId: id,
    });
  },
};

export default Toast;
