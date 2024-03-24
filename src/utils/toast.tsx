import { Toast as FBToast } from "flowbite-react";
import {
  HiCheck,
  HiExclamation,
  HiInformationCircle,
  HiX,
} from "react-icons/hi";
import { ToastOptions, toast } from "react-toastify";

const toastOptions: ToastOptions = {
  className: "p-0",
  bodyClassName: "p-0",
  progressStyle: { background: "none" },
};

const iconWrapperClass: string =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg";
const iconClass: string = "h-5 w-5";

const Toast = {
  success: (message: string, id?: string) => {
    toast(
      <div>
        <FBToast>
          <div
            className={`${iconWrapperClass} bg-green-100 text-green-500 dark:bg-green-800 dark:text-green-200`}
          >
            <HiCheck className={iconClass} />
          </div>
          <div className="ml-3 text-sm font-normal">{message}</div>
          <FBToast.Toggle onClick={() => toast.dismiss(id)} />
        </FBToast>
      </div>,
      {
        ...toastOptions,
        toastId: id,
        progressClassName: "!bg-green-500",
      },
    );
  },
  error: (message: string, id?: string) => {
    toast(
      <div>
        <FBToast>
          <div
            className={`${iconWrapperClass} bg-red-100 text-red-500 dark:bg-red-800 dark:text-red-200`}
          >
            <HiX className={iconClass} />
          </div>
          <div className="ml-3 text-sm font-normal">{message}</div>
          <FBToast.Toggle onClick={() => toast.dismiss(id)} />
        </FBToast>
      </div>,
      {
        ...toastOptions,
        toastId: id,
        progressClassName: "!bg-red-500",
      },
    );
  },
  warning: (message: string, id?: string) => {
    toast(
      <div>
        <FBToast>
          <div
            className={`${iconWrapperClass} bg-orange-100 text-orange-500 dark:bg-orange-800 dark:text-orange-200`}
          >
            <HiExclamation className={iconClass} />
          </div>
          <div className="ml-3 text-sm font-normal">{message}</div>
          <FBToast.Toggle onClick={() => toast.dismiss(id)} />
        </FBToast>
      </div>,
      {
        ...toastOptions,
        toastId: id,
        progressClassName: "!bg-orange-500",
      },
    );
  },
  info: (message: string, id?: string) => {
    toast(
      <div>
        <FBToast>
          <div
            className={`${iconWrapperClass} bg-cyan-100 text-cyan-500 dark:bg-cyan-800 dark:text-cyan-200`}
          >
            <HiInformationCircle className={iconClass} />
          </div>
          <div className="ml-3 text-sm font-normal">{message}</div>
          <FBToast.Toggle onClick={() => toast.dismiss(id)} />
        </FBToast>
      </div>,
      {
        ...toastOptions,
        toastId: id,
        progressClassName: "!bg-cyan-500",
      },
    );
  },
};

export default Toast;
