import { Spinner } from "flowbite-react";
import { useEffect } from "react";
import { useAppSelector, useAuth } from "../app/hooks";
import { RootState } from "../app/store";

const SplashPage = () => {
  const auth = useAuth();
  const { isSuccess } = useAppSelector((state: RootState) => state.profile);

  useEffect(() => {
    if (isSuccess) {
      auth.signin(() => {
        auth.setIsLoading(false);
      });
    }
  }, [isSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex justify-center items-center h-screen w-screen bg-neutral-50">
      <Spinner size={"lg"} />
    </div>
  );
};

export default SplashPage;
