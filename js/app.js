// js/app.js

(function () {
    var loginPanel = document.getElementById("login-panel");
    var adminPanel = document.getElementById("admin-panel");

    var loginForm = document.getElementById("login-form");
    var loginStatus = document.getElementById("login-status");

    var adminEmailEl = document.getElementById("admin-email");
    var adminUidEl = document.getElementById("admin-uid");
    var universityIdEl = document.getElementById("university-id");
    var universityIdInlineEl = document.getElementById("university-id-inline");

    var universityNameInput = document.getElementById("university-name");
    var universityDescriptionInput = document.getElementById("university-description");

    var adminStatus = document.getElementById("admin-status");
    var saveButton = document.getElementById("save-university");
    var logoutButton = document.getElementById("logout");

    var currentUser = null;          // { id, login, fullName, role, universityId }
    var currentUniversityId = null;

    function showLogin() {
        loginPanel.classList.remove("hidden");
        adminPanel.classList.add("hidden");
        loginStatus.textContent = "";
        adminStatus.textContent = "";
        currentUser = null;
        currentUniversityId = null;
    }

    function showAdmin() {
        loginPanel.classList.add("hidden");
        adminPanel.classList.remove("hidden");
        loginStatus.textContent = "";
        adminStatus.textContent = "";
    }

    function setLoginStatus(message, isError) {
        loginStatus.textContent = message || "";
        loginStatus.classList.remove("ok", "err");
        if (!message) return;
        loginStatus.classList.add(isError ? "err" : "ok");
    }

    function setAdminStatus(message, isError) {
        adminStatus.textContent = message || "";
        adminStatus.classList.remove("ok", "err");
        if (!message) return;
        adminStatus.classList.add(isError ? "err" : "ok");
    }

    // Вход по своей коллекции users
    if (loginForm) {
        loginForm.addEventListener("submit", function (e) {
            e.preventDefault();

            var login = document.getElementById("login").value.trim();
            var password = document.getElementById("password").value;

            if (!login || !password) {
                setLoginStatus("Введите логин и пароль", true);
                return;
            }

            setLoginStatus("Проверяем пользователя...", false);

            db.collection("users")
                .where("login", "==", login)
                .limit(1)
                .get()
                .then(function (querySnapshot) {
                    if (querySnapshot.empty) {
                        throw new Error("Пользователь с таким логином не найден");
                    }

                    var doc = querySnapshot.docs[0];
                    var data = doc.data();

                    // ВНИМАНИЕ: это учебный пример — пароль в лоб, без хэша
                    if (data.password !== password) {
                        throw new Error("Неверный пароль");
                    }

                    if (data.role !== "admin") {
                        throw new Error("У этого пользователя нет прав администратора");
                    }

                    if (!data.universityId) {
                        throw new Error("Для администратора не указан universityId");
                    }

                    currentUser = {
                        id: doc.id,
                        login: data.login,
                        fullName: data.fullName,
                        role: data.role,
                        universityId: data.universityId
                    };

                    currentUniversityId = data.universityId;

                    adminEmailEl.textContent =
                        (currentUser.fullName || "(без имени)") + " (" + currentUser.login + ")";
                    adminUidEl.textContent = currentUser.id;
                    universityIdEl.textContent = currentUniversityId;
                    universityIdInlineEl.textContent = currentUniversityId;

                    showAdmin();
                    setLoginStatus("");

                    // Загружаем данные по вузу
                    return db.collection("universities").doc(currentUniversityId).get();
                })
                .then(function (uniDoc) {
                    if (!uniDoc) return;

                    if (uniDoc.exists) {
                        var uniData = uniDoc.data();
                        universityNameInput.value = uniData.name || "";
                        universityDescriptionInput.value = uniData.description || "";
                    } else {
                        universityNameInput.value = "";
                        universityDescriptionInput.value = "";
                        setAdminStatus(
                            "Документ вуза ещё не создан. Заполните поля и нажмите «Сохранить».",
                            false
                        );
                    }
                })
                .catch(function (error) {
                    console.error("Ошибка входа:", error);
                    setLoginStatus(error.message || "Ошибка входа", true);
                });
        });
    }

    // Сохранение данных по вузу
    if (saveButton) {
        saveButton.addEventListener("click", function () {
            if (!currentUniversityId) {
                setAdminStatus("ID вуза не определён. Войдите заново.", true);
                return;
            }

            var name = universityNameInput.value.trim();
            var description = universityDescriptionInput.value.trim();

            setAdminStatus("Сохраняем...", false);

            db.collection("universities")
                .doc(currentUniversityId)
                .set(
                    {
                        name: name,
                        description: description,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    },
                    { merge: true }
                )
                .then(function () {
                    setAdminStatus("Изменения сохранены", false);
                })
                .catch(function (error) {
                    console.error("Ошибка сохранения:", error);
                    setAdminStatus("Ошибка сохранения: " + error.message, true);
                });
        });
    }

    // "Выход" — просто очистка состояния и показ формы логина
    if (logoutButton) {
        logoutButton.addEventListener("click", function () {
            showLogin();
        });
    }

    // При загрузке страницы просто показываем форму логина
    showLogin();
})();
