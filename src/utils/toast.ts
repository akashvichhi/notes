import { toast } from "react-toastify";

const Toast = {
  success: (message: string) => {
    toast.success(message);
  },
  error: (message: string) => {
    toast.error(message);
  },
  warning: (message: string) => {
    toast.warn(message);
  },
  info: (message: string) => {
    toast.info(message);
  },
};

export default Toast;
