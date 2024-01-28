import { Avatar, Dropdown } from "flowbite-react";
import { useState } from "react";
import { FiLock, FiLogOut, FiUser } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { logout } from "../../reducers/authSlice";
import { useAppDispatch } from "../../hooks/redux";
import ChangePassword from "../profile/ChangePassword";
import EditProfile from "../profile/EditProfile";
import { useAuth } from "../../hooks/useAuth";

const Header = () => {
  const auth = useAuth();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [showEditProfile, setShowEditProfile] = useState<boolean>(false);
  const [showChangePassword, setShowChangePassword] = useState<boolean>(false);

  const signout = async () => {
    await dispatch(logout());
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
    <header className="px-4 py-3 shadow relative z-50">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl">Notes</h1>
        <div>
          <Dropdown
            label={""}
            inline
            renderTrigger={() => (
              <div>
                <Avatar rounded size={"sm"} className="cursor-pointer" />
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
