import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { updateUser, getUser } from "../../../api/user.js";
import { fetchImageById } from "../../../api/image.js";

export default function AccountInfo() {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    id: "",
    email: "",
    username: "",
    userDetails: {
      firstName: "",
      lastName: "",
      phoneNumber: "",
      gender: "MALE",
      aboutMe: "",
      birthDate: "",
    },
  });

  const [file, setFile] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const prevUrlRef = useRef(""); // giữ objectURL hiện tại để revoke
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [toast, setToast] = useState({ open: false, text: "" });

  const normalizeBirth = (val) => {
    if (!val) return "";
    const raw = String(val);
    if (raw.toLowerCase() === "null" || raw.toLowerCase() === "undefined") return "";
    return raw.split("T")[0].split(" ")[0];
  };

  const loadAvatar = async (me) => {
    const imageId = me?.userDetails?.imageUrl ?? me?.imageUrl;
    if (!imageId) {
      setAvatarUrl("");
      window.dispatchEvent(new CustomEvent("userAvatarUpdated", { detail: { avatarUrl: "", imageId: null } }));
      return;
    }
    try {
      const resp = await fetchImageById(imageId); // arraybuffer
      const type = resp.headers?.["content-type"] || "image/jpeg";
      const blob = new Blob([resp.data], { type });
      const url = URL.createObjectURL(blob);
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
      prevUrlRef.current = url;
      setAvatarUrl(url);
      window.dispatchEvent(new CustomEvent("userAvatarUpdated", { detail: { avatarUrl: url, imageId } }));
    } catch (e) {
      console.error("Failed to fetch avatar", e);
      setAvatarUrl("");
      window.dispatchEvent(new CustomEvent("userAvatarUpdated", { detail: { avatarUrl: "", imageId: null } }));
    }
  };

  const loadUserProfile = async () => {
    try {
      const me = await getUser();

      setForm({
        id: me?.id ?? "",
        email: me?.email ?? "",
        username: me?.username ?? "",
        userDetails: {
          firstName: me?.userDetails?.firstName ?? me?.firstName ?? "",
          lastName: me?.userDetails?.lastName ?? me?.lastName ?? "",
          phoneNumber: me?.userDetails?.phoneNumber ?? me?.phoneNumber ?? "",
          gender: me?.userDetails?.gender ?? me?.gender ?? "MALE",
          aboutMe: me?.userDetails?.aboutMe ?? me?.aboutMe ?? "",
          birthDate: normalizeBirth(me?.userDetails?.birthDate ?? me?.birthDate),
        },
      });

      await loadAvatar(me);
    } catch (e) {
      console.error("Failed to fetch user data", e);
    }
  };

  useEffect(() => {
    loadUserProfile();

    return () => {
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
    };
  }, []);

  const onChangeRoot = (e) => {
    const { id, value } = e.target;
    setForm((p) => ({ ...p, [id]: value }));
  };
  const onChangeDetails = (e) => {
    const { id, value } = e.target;
    setForm((p) => ({
      ...p,
      userDetails: {
        ...p.userDetails,
        [id]: id === "birthDate" && value === "null" ? "" : value,
      },
    }));
  };

  // (tuỳ chọn) cắt ảnh thành vuông trước khi upload
  const cropToSquare = async (file) => {
    const bitmap = await createImageBitmap(file);
    const size = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - size) / 2;
    const sy = (bitmap.height - size) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, sx, sy, size, size, 0, 0, size, size);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, file.type || "image/jpeg", 0.9)
    );
    return new File([blob], file.name.replace(/\.\w+$/, "") + "_sq.jpg", {
      type: blob.type,
    });
  };

  const onFile = async (e) => {
    const picked = e.target.files?.[0] || null;
    if (!picked) return;
    const squared = await cropToSquare(picked); // bảo đảm vuông
    setFile(squared);
    const previewUrl = URL.createObjectURL(squared);
    if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
    prevUrlRef.current = previewUrl;
    setAvatarUrl(previewUrl);
    window.dispatchEvent(new CustomEvent("userAvatarUpdated", { detail: { avatarUrl: previewUrl, imageId: null } }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      // Chỉ gửi các field có giá trị thực sự
      const userDetailsToSend = {};
      
      if (form.userDetails.firstName && form.userDetails.firstName.trim()) {
        userDetailsToSend.firstName = form.userDetails.firstName.trim();
      }
      if (form.userDetails.lastName && form.userDetails.lastName.trim()) {
        userDetailsToSend.lastName = form.userDetails.lastName.trim();
      }
      if (form.userDetails.phoneNumber && form.userDetails.phoneNumber.trim()) {
        userDetailsToSend.phoneNumber = form.userDetails.phoneNumber.trim();
      }
      if (form.userDetails.gender) {
        userDetailsToSend.gender = form.userDetails.gender;
      }
      if (form.userDetails.aboutMe && form.userDetails.aboutMe.trim()) {
        userDetailsToSend.aboutMe = form.userDetails.aboutMe.trim();
      }
      if (form.userDetails.birthDate && form.userDetails.birthDate.trim()) {
        userDetailsToSend.birthDate = form.userDetails.birthDate.trim();
      }

      const formDataToSend = {
        id: form.id,
        email: form.email,
        username: form.username,
        userDetails: userDetailsToSend
      };
      // Chỉ gửi password nếu có nhập
      if (form.password && String(form.password).trim()) {
        formDataToSend.password = String(form.password).trim();
      }

      console.log("Sending data:", formDataToSend);
      await updateUser(formDataToSend, file);
      // after update, reload to get new image id & data
      await loadUserProfile();
      setMsg(t('accountInfo.updateSuccess'));
      setToast({ open: true, text: t('accountInfo.updateSuccess') });
      setTimeout(() => setToast({ open: false, text: "" }), 1800);
    } catch (err) {
      const backendMsg = err?.response?.data?.message;
      const finalMsg = backendMsg || err?.message || t('accountInfo.updateFailure');
      console.error("Update failed:", err?.response || err);
      setMsg(finalMsg);
      setToast({ open: true, text: finalMsg });
      setTimeout(() => setToast({ open: false, text: "" }), 2200);
    } finally {
      setLoading(false);
    }
  };

  // style cho avatar vuông, đặt trong form
  const avatarStyles = {
    inline: { display: "flex", alignItems: "center", gap: 12 },
    btn: {
      width: 120,
      height: 120,
      borderRadius: 12,
      overflow: "hidden",
      border: "1px solid #e5e7eb",
      background: "#f9fafb",
      padding: 0,
      cursor: "pointer",
      position: "relative",
    },
    img: {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      display: "block",
    },
    placeholder: {
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 32,
      color: "#9ca3af",
    },
    hint: { fontSize: 12, color: "#6b7280" },
  };

  return (
    <div className="tab-pane fade show active">
      <div className="myaccount-content">
        <h3>{t('accountInfo.title')}</h3>
        {msg && <div style={{ marginBottom: 12 }}>{msg}</div>}

        <div className="account-details-form">
          <form onSubmit={onSubmit}>
            <div className="row">
              <div className="col-lg-6">
                <div className="single-input-item">
                  <label htmlFor="firstName" className="required">
                    {t('accountInfo.firstName')}
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    value={form.userDetails.firstName}
                    onChange={onChangeDetails}
                  />
                </div>
              </div>
              <div className="col-lg-6">
                <div className="single-input-item">
                  <label htmlFor="lastName" className="required">
                    {t('accountInfo.lastName')}
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    value={form.userDetails.lastName}
                    onChange={onChangeDetails}
                  />
                </div>
              </div>
            </div>

            <div className="single-input-item">
              <label htmlFor="username" className="required">
                {t('accountInfo.displayName')}
              </label>
              <input
                type="text"
                id="username"
                value={form.username}
                onChange={onChangeRoot}
              />
            </div>

            <div className="single-input-item">
              <label htmlFor="email" className="required">
                {t('accountInfo.emailAddress')}
              </label>
              <input
                type="email"
                id="email"
                value={form.email}
                onChange={onChangeRoot}
              />
            </div>

            <div className="row">
              <div className="col-lg-6">
                <div className="single-input-item">
                  <label htmlFor="phoneNumber">{t('accountInfo.phone')}</label>
                  <input
                    type="text"
                    id="phoneNumber"
                    value={form.userDetails.phoneNumber}
                    onChange={onChangeDetails}
                  />
                </div>
              </div>
              <div className="col-lg-6">
            <div className="single-input-item">
                  <label htmlFor="birthDate">{t('accountInfo.birthDate')}</label>
                  <input
                    type="date"
                    id="birthDate"
                value={form.userDetails.birthDate || ""}
                    onChange={onChangeDetails}
                  />
                </div>
              </div>
            </div>

            <div className="single-input-item">
              <label htmlFor="aboutMe">{t('accountInfo.aboutMe')}</label>
              <input
                type="text"
                id="aboutMe"
                value={form.userDetails.aboutMe}
                onChange={onChangeDetails}
              />
            </div>

            <div className="row" style={{ alignItems: "center" }}>
              <div className="col-md-6">
                <div className="mb-3">
                  <label htmlFor="gender" className="form-label">
                    {t('accountInfo.gender')}
                  </label>
                  <select
                    id="gender"
                    className="form-select"
                    value={form.userDetails.gender}
                    onChange={onChangeDetails}
                    aria-label={t('accountInfo.gender')}
                  >
                    <option value="MALE">{t('accountInfo.male')}</option>
                    <option value="FEMALE">{t('accountInfo.female')}</option>
                    <option value="OTHER">{t('accountInfo.other')}</option>
                  </select>
                </div>
              </div>

              <div className="col-md-6">
                <div className="single-input-item">
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <button
                      type="button"
                      style={avatarStyles.btn}
                      onClick={() => fileInputRef.current?.click()}
                      title={t('accountInfo.clickToChange')}
                    >
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt="avatar"
                          style={avatarStyles.img}
                        />
                      ) : (
                        <div style={avatarStyles.placeholder}>＋</div>
                      )}
                    </button>
                  </div>
                  <label htmlFor="avatar"> </label>
                  {t('accountInfo.avatar')}{" "}
                  <small style={avatarStyles.hintBelow}>
                    : {t('accountInfo.avatarHint')}
                  </small>
                  <input
                    ref={fileInputRef}
                    id="avatar"
                    type="file"
                    accept="image/*"
                    onChange={onFile}
                    hidden
                  />
                </div>
              </div>
            </div>

            <div className="single-input-item">
              <button className="check-btn sqr-btn" disabled={loading}>
                {loading ? t('accountInfo.saving') : t('accountInfo.saveChanges')}
              </button>
            </div>

            <input type="hidden" id="id" value={form.id} readOnly />
          </form>
        </div>
      </div>

      {toast.open && (
        <div
          style={{
            position: "fixed",
            top: "40%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "rgba(0,0,0,0.8)",
            color: "white",
            padding: "14px 18px",
            borderRadius: 6,
            zIndex: 2000,
            minWidth: 220,
            textAlign: "center",
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)"
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
            ✓
          </div>
          <div style={{ fontSize: 14 }}>{toast.text}</div>
        </div>
      )}
    </div>
  );
}