import { Avatar, Dropdown } from "flowbite-react";
import { lazy, useState } from "react";
import { FiLock, FiLogOut, FiUser } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { logout } from "../../reducers/authSlice";
import { useAppDispatch, useAuth } from "../../store/hooks";

const ChangePassword = lazy(() => import("../profile/ChangePassword"));
const EditProfile = lazy(() => import("../profile/EditProfile"));

const Header = () => {
  const auth = useAuth();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [showEditProfile, setShowEditProfile] = useState<boolean>(false);
  const [showChangePassword, setShowChangePassword] = useState<boolean>(false);

  const signout = () => {
    dispatch(logout());
    auth.signout(() => {
      navigate("/login");
    });
  };

  const editProfile = () => {
    setShowEditProfile(true);
  };

  const closeEditProfile = () => {
    setShowEditProfile(false);
  };

  const editPassword = () => {
    setShowChangePassword(true);
  };

  const closeChangePassword = () => {
    setShowChangePassword(false);
  };

  return (
    <header className="px-4 py-3 shadow bg-white">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl">Notes</h1>
        <div>
          <Dropdown
            label={<Avatar rounded className="cursor-pointer" />}
            inline
            renderTrigger={() => (
              <div>
                <Avatar rounded className="cursor-pointer" />
              </div>
            )}
            placement="bottom-end"
          >
            <Dropdown.Item icon={FiUser} onClick={editProfile}>
              Your Profile
            </Dropdown.Item>
            <Dropdown.Item icon={FiLock} onClick={editPassword}>
              Change Password
            </Dropdown.Item>
            <Dropdown.Item icon={FiLogOut} onClick={signout}>
              Logout
            </Dropdown.Item>
          </Dropdown>
        </div>
      </div>
      {showEditProfile && (
        <EditProfile show={showEditProfile} onClose={closeEditProfile} />
      )}
      {showChangePassword && (
        <ChangePassword
          show={showChangePassword}
          onClose={closeChangePassword}
        />
      )}
    </header>
  );
};

export default Header;
