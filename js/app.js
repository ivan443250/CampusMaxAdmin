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
    var saveUniversityButton = document.getElementById("save-university");
    var logoutButton = document.getElementById("logout");

    // --- элементы расписания ---
    var scheduleDaySelect = document.getElementById("schedule-day");
    var scheduleGroupInput = document.getElementById("schedule-group");
    var scheduleStartInput = document.getElementById("schedule-start");
    var scheduleEndInput = document.getElementById("schedule-end");
    var scheduleSubjectInput = document.getElementById("schedule-subject");
    var scheduleTeacherInput = document.getElementById("schedule-teacher");
    var scheduleRoomInput = document.getElementById("schedule-room");
    var scheduleSaveButton = document.getElementById("schedule-save");
    var scheduleCancelButton = document.getElementById("schedule-cancel");
    var scheduleStatus = document.getElementById("schedule-status");
    var scheduleTableBody = document.getElementById("schedule-table-body");

    var currentUser = null;          // { id, login, fullName, role, universityId, group }
    var currentUniversityId = null;

    var editingScheduleId = null;    // id редактируемой пары или null

    var dayNames = {
        1: "Понедельник",
        2: "Вторник",
        3: "Среда",
        4: "Четверг",
        5: "Пятница",
        6: "Суббота",
        7: "Воскресенье"
    };

    function showLogin() {
        loginPanel.classList.remove("hidden");
        adminPanel.classList.add("hidden");
        loginStatus.textContent = "";
        adminStatus.textContent = "";
        setScheduleStatus("");
        currentUser = null;
        currentUniversityId = null;
        editingScheduleId = null;
    }

    function showAdmin() {
        loginPanel.classList.add("hidden");
        adminPanel.classList.remove("hidden");
        loginStatus.textContent = "";
        adminStatus.textContent = "";
        setScheduleStatus("");
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

    function setScheduleStatus(message, isError) {
        scheduleStatus.textContent = message || "";
        scheduleStatus.classList.remove("ok", "err");
        if (!message) return;
        scheduleStatus.classList.add(isError ? "err" : "ok");
    }

    // ---------------- ВХОД ----------------

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
                        universityId: data.universityId,
                        group: data.group
                    };

                    currentUniversityId = data.universityId;

                    adminEmailEl.textContent =
                        (currentUser.fullName || "(без имени)") + " (" + currentUser.login + ")";
                    adminUidEl.textContent = currentUser.id;
                    universityIdEl.textContent = currentUniversityId;
                    universityIdInlineEl.textContent = currentUniversityId;

                    if (currentUser.group && scheduleGroupInput) {
                        scheduleGroupInput.value = currentUser.group;
                    }

                    showAdmin();
                    setLoginStatus("");

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
                            "Документ вуза ещё не создан. Заполните поля и нажмите «Сохранить информацию о вузе».",
                            false
                        );
                    }

                    return loadSchedule();
                })
                .catch(function (error) {
                    console.error("Ошибка входа:", error);
                    setLoginStatus(error.message || "Ошибка входа", true);
                });
        });
    }

    // ----------- СОХРАНЕНИЕ ИНФЫ О ВУЗЕ -----------

    if (saveUniversityButton) {
        saveUniversityButton.addEventListener("click", function () {
            if (!currentUniversityId) {
                setAdminStatus("ID вуза не определён. Войдите заново.", true);
                return;
            }

            var name = universityNameInput.value.trim();
            var description = universityDescriptionInput.value.trim();

            setAdminStatus("Сохраняем информацию о вузе...", false);

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
                    setAdminStatus("Информация о вузе сохранена", false);
                })
                .catch(function (error) {
                    console.error("Ошибка сохранения вуза:", error);
                    setAdminStatus("Ошибка сохранения: " + error.message, true);
                });
        });
    }

    // ---------------- ВЫХОД ----------------

    if (logoutButton) {
        logoutButton.addEventListener("click", function () {
            showLogin();
        });
    }

    // ------------ РАСПИСАНИЕ: CRUD ------------

    function clearScheduleForm() {
        if (!scheduleDaySelect) return;

        scheduleDaySelect.value = "1";
        if (!currentUser || !currentUser.group) {
            scheduleGroupInput.value = "";
        } else {
            scheduleGroupInput.value = currentUser.group;
        }
        scheduleStartInput.value = "";
        scheduleEndInput.value = "";
        scheduleSubjectInput.value = "";
        scheduleTeacherInput.value = "";
        scheduleRoomInput.value = "";

        editingScheduleId = null;
        scheduleSaveButton.textContent = "Добавить в расписание";
        scheduleCancelButton.classList.add("hidden");
        setScheduleStatus("");
    }

    function loadSchedule() {
        if (!currentUniversityId || !scheduleTableBody) {
            return Promise.resolve();
        }

        setScheduleStatus("Загружаем расписание...", false);

        return db
            .collection("universities")
            .doc(currentUniversityId)
            .collection("schedule")
            .orderBy("dayOfWeek")
            .get()
            .then(function (snapshot) {
                renderSchedule(snapshot);
                setScheduleStatus("Расписание загружено", false);
            })
            .catch(function (error) {
                console.error("Ошибка загрузки расписания:", error);
                setScheduleStatus("Ошибка загрузки: " + error.message, true);
            });
    }

    function renderSchedule(snapshot) {
        if (!scheduleTableBody) return;

        scheduleTableBody.innerHTML = "";

        if (snapshot.empty) {
            var tr = document.createElement("tr");
            var td = document.createElement("td");
            td.colSpan = 7;
            td.textContent = "Расписание пока пустое.";
            scheduleTableBody.appendChild(tr);
            tr.appendChild(td);
            return;
        }

        snapshot.forEach(function (doc) {
            var data = doc.data();

            var tr = document.createElement("tr");

            var tdDay = document.createElement("td");
            var tdTime = document.createElement("td");
            var tdGroup = document.createElement("td");
            var tdSubject = document.createElement("td");
            var tdTeacher = document.createElement("td");
            var tdRoom = document.createElement("td");
            var tdActions = document.createElement("td");

            tdDay.textContent = dayNames[data.dayOfWeek] || data.dayOfWeek || "";
            tdTime.textContent = (data.startTime || "") + (data.endTime ? " — " + data.endTime : "");
            tdGroup.textContent = data.group || "";
            tdSubject.textContent = data.subject || "";
            tdTeacher.textContent = data.teacher || "";
            tdRoom.textContent = data.room || "";

            tdActions.className = "actions-cell";

            var editBtn = document.createElement("button");
            editBtn.type = "button";
            editBtn.textContent = "Изм.";
            editBtn.addEventListener("click", function () {
                startEditLesson(doc.id, data);
            });

            var deleteBtn = document.createElement("button");
            deleteBtn.type = "button";
            deleteBtn.textContent = "X";
            deleteBtn.classList.add("secondary");
            deleteBtn.addEventListener("click", function () {
                deleteLesson(doc.id);
            });

            tdActions.appendChild(editBtn);
            tdActions.appendChild(deleteBtn);

            tr.appendChild(tdDay);
            tr.appendChild(tdTime);
            tr.appendChild(tdGroup);
            tr.appendChild(tdSubject);
            tr.appendChild(tdTeacher);
            tr.appendChild(tdRoom);
            tr.appendChild(tdActions);

            scheduleTableBody.appendChild(tr);
        });
    }

    function startEditLesson(id, data) {
        editingScheduleId = id;
        scheduleDaySelect.value = String(data.dayOfWeek || 1);
        scheduleGroupInput.value = data.group || "";
        scheduleStartInput.value = data.startTime || "";
        scheduleEndInput.value = data.endTime || "";
        scheduleSubjectInput.value = data.subject || "";
        scheduleTeacherInput.value = data.teacher || "";
        scheduleRoomInput.value = data.room || "";

        scheduleSaveButton.textContent = "Сохранить изменения";
        scheduleCancelButton.classList.remove("hidden");
        setScheduleStatus("Редактирование пары", false);
    }

    function deleteLesson(id) {
        if (!currentUniversityId || !id) return;

        var confirmed = window.confirm("Удалить эту пару из расписания?");
        if (!confirmed) return;

        db.collection("universities")
            .doc(currentUniversityId)
            .collection("schedule")
            .doc(id)
            .delete()
            .then(function () {
                setScheduleStatus("Пара удалена", false);
                if (editingScheduleId === id) {
                    clearScheduleForm();
                }
                return loadSchedule();
            })
            .catch(function (error) {
                console.error("Ошибка удаления пары:", error);
                setScheduleStatus("Ошибка удаления: " + error.message, true);
            });
    }

    if (scheduleSaveButton) {
        scheduleSaveButton.addEventListener("click", function () {
            if (!currentUniversityId) {
                setScheduleStatus("ID вуза не определён. Войдите заново.", true);
                return;
            }

            var day = parseInt(scheduleDaySelect.value, 10);
            var group = scheduleGroupInput.value.trim();
            var startTime = scheduleStartInput.value;
            var endTime = scheduleEndInput.value;
            var subject = scheduleSubjectInput.value.trim();
            var teacher = scheduleTeacherInput.value.trim();
            var room = scheduleRoomInput.value.trim();

            if (!day || !group || !startTime || !subject) {
                setScheduleStatus("Обязательные поля: день, группа, начало пары, предмет.", true);
                return;
            }

            var lessonData = {
                dayOfWeek: day,
                group: group,
                startTime: startTime,
                endTime: endTime || "",
                subject: subject,
                teacher: teacher,
                room: room,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            var ref = db
                .collection("universities")
                .doc(currentUniversityId)
                .collection("schedule");

            setScheduleStatus("Сохраняем пару...", false);

            var promise;
            if (editingScheduleId) {
                promise = ref.doc(editingScheduleId).set(lessonData, { merge: true });
            } else {
                lessonData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                promise = ref.add(lessonData);
            }

            promise
                .then(function () {
                    setScheduleStatus("Пара сохранена", false);
                    clearScheduleForm();
                    return loadSchedule();
                })
                .catch(function (error) {
                    console.error("Ошибка сохранения пары:", error);
                    setScheduleStatus("Ошибка сохранения: " + error.message, true);
                });
        });
    }

    if (scheduleCancelButton) {
        scheduleCancelButton.addEventListener("click", function () {
            clearScheduleForm();
        });
    }

    // При загрузке — форма логина
    showLogin();
})();
