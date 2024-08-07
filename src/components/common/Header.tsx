import { Avatar, Dropdown } from "flowbite-react";
import { useCallback, useState } from "react";
import { FaUserCircle } from "react-icons/fa";
import { FiLock, FiLogOut, FiUser } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { useAppDispatch } from "../../hooks/redux";
import { useAuth } from "../../hooks/useAuth";
import { clearState as clerNotes } from "../../reducers/notes/notesSlice";
import { clearState as clerProfile } from "../../reducers/profile/profileSlice";
import { logout } from "../../services/auth/authServices";
import ChangePassword from "../profile/ChangePassword";
import EditProfile from "../profile/EditProfile";

const Header = () => {
  const auth = useAuth();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [showEditProfile, setShowEditProfile] = useState<boolean>(false);
  const [showChangePassword, setShowChangePassword] = useState<boolean>(false);

  const signout = useCallback(() => {
    dispatch(logout());
    auth.signout(() => {
      dispatch(clerNotes());
      dispatch(clerProfile());
      navigate("/login");
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const editProfile = useCallback(() => {
    setShowEditProfile(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const closeEditProfile = useCallback(() => {
    setShowEditProfile(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const editPassword = useCallback(() => {
    setShowChangePassword(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const closeChangePassword = useCallback(() => {
    setShowChangePassword(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <header className="header px-4 py-3 shadow relative z-50">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl flex items-center gap-3">
          <img src="/logo.png" alt="Notes" className="w-6" />
          Notes
        </h1>
        <div>
          <Dropdown
            label={
              <Avatar
                rounded
                img={(props) => <FaUserCircle {...props} color="gray" />}
                size={"sm"}
                className="cursor-pointer"
              />
            }
            inline
            arrowIcon={false}
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
