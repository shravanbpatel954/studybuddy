import React, { useEffect, useState } from "react";
import "./ProfilePage.css";
import useAuth from "../hooks/useAuth";
import api from "../services/api";

export default function ProfilePage() {
  const { user: authUser, setUser, token } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ displayName: "", photo: "", bio: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Always fetch fresh profile data from backend
    const fetchProfile = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        const data = await api.get('/auth/profile');
        // backend returns { user }
        if (data && data.user) {
          const userData = data.user;
          setUser(userData);
          
          // Initialize form with user data
          setForm({
            displayName: userData.displayName || userData.name || "",
            photo: userData.photo || "",
            bio: userData.bio || "",
          });
        } else if (data && !data.user) {
          // If data is the user object directly
          setUser(data);
          setForm({
            displayName: data.displayName || data.name || "",
            photo: data.photo || "",
            bio: data.bio || "",
          });
        }
      } catch (err) {
        console.error('ProfilePage: failed to fetch profile', err);
        // If fetch fails but we have cached user data, use it
        if (authUser && Object.keys(authUser).length > 0) {
          const { displayName, name, photo, bio } = authUser;
          setForm({
            displayName: displayName || name || "",
            photo: photo || "",
            bio: bio || "",
          });
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]); // Only depend on token, fetch fresh data when token changes

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const save = async (e) => {
    e.preventDefault();
    if (!token) return alert("Not authenticated");
    setLoading(true);

    try {
      const data = await api.patch("/auth/profile", {
        displayName: form.displayName,
        photo: form.photo,
        bio: form.bio,
      });

      if (data && data.user) {
        setUser(data.user); // Update shared auth state
        setEditing(false);

        // For backward compatibility with components that still use these
        localStorage.setItem("userName", data.user.displayName || data.user.name || "");
        localStorage.setItem("userEmail", data.user.email || "");
        localStorage.setItem("userPhoto", data.user.photo || "");
      } else {
        throw new Error(data.error || "Failed to update profile");
      }
    } catch (err) {
      console.error("Save profile failed", err);
      alert(err.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  // Get current user data (from state or authUser)
  const currentUser = authUser && Object.keys(authUser).length > 0 ? authUser : null;
  
  if (loading) {
    return (
      <div className="profile-page">
        <h2>My Profile</h2>
        <div className="profile-card">Loading profile...</div>
      </div>
    );
  }

  if (!currentUser || !token) {
    return (
      <div className="profile-page">
        <h2>My Profile</h2>
        <div className="profile-card">Please log in to view your profile.</div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <h2>My Profile</h2>
      <div className="profile-card">
        <div className="profile-top">
          {currentUser.photo ? (
            <img src={currentUser.photo} alt="avatar" className="profile-photo" />
          ) : (
            <div className="profile-avatar">
              {(currentUser.displayName || currentUser.name || "U").charAt(0).toUpperCase()}
            </div>
          )}

          <div className="profile-meta">
            <h3>{currentUser.displayName || currentUser.name || "Unnamed"}</h3>
            <p className="muted">{currentUser.email || "No email"}</p>
          </div>
        </div>

        {!editing ? (
          <div className="profile-details">
            {currentUser.bio && (
              <p>
                <strong>About:</strong> {currentUser.bio}
              </p>
            )}
            <div className="profile-actions">
              <button onClick={() => setEditing(true)}>Edit Profile</button>
            </div>
          </div>
        ) : (
          <form className="profile-edit-form" onSubmit={save}>
            <label>Name</label>
            <input
              name="displayName"
              value={form.displayName}
              onChange={handleChange}
            />

            <label>Photo URL</label>
            <input
              name="photo"
              value={form.photo}
              onChange={handleChange}
              placeholder="https://..."
            />

            <label>About / Bio</label>
            <textarea name="bio" value={form.bio} onChange={handleChange} />

            <div className="profile-actions">
              <button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setForm({
                    displayName: currentUser.displayName || currentUser.name || "",
                    photo: currentUser.photo || "",
                    bio: currentUser.bio || "",
                  });
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
