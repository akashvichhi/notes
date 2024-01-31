import { Spinner } from "flowbite-react";

const Splash = () => {
  return (
    <div className="flex justify-center items-center h-screen w-screen bg-neutral-50">
      <Spinner color="warning" size={"lg"} />
    </div>
  );
};

export default Splash;
