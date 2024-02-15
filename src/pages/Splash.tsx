import Loader from "../components/common/Loader";

const Splash = () => {
  return (
    <div className="flex justify-center items-center h-screen w-screen gap-2">
      <div className="relative">
        <img
          src={"/logo.png"}
          className="absolute left-1/2 top-1/2 translate-x-[-50%] translate-y-[-50%]"
          width={20}
        />
        <Loader size={"xl"} />
      </div>
    </div>
  );
};

export default Splash;
