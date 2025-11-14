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

    var scheduleWeekSelect = document.getElementById("schedule-week");
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

    var currentUser = null;
    var currentUniversityId = null;

    var editingWeekKey = null;
    var editingDayKey = null;
    var editingLessonId = null;
    var editingGroupKey = null;

    var scheduleByDay = {}; // { "1": [lessons...], "2": [...] }

    var dayNames = {
        1: "Понедельник",
        2: "Вторник",
        3: "Среда",
        4: "Четверг",
        5: "Пятница",
        6: "Суббота",
        7: "Воскресенье"
    };

    function getCurrentWeekKey() {
        return (scheduleWeekSelect && scheduleWeekSelect.value) || "even";
    }

    function getCurrentGroupKey() {
        if (currentUser && currentUser.group) {
            return currentUser.group;
        }
        var g = scheduleGroupInput ? scheduleGroupInput.value.trim() : "";
        return g || "DEFAULT_GROUP";
    }

    function generateLessonId() {
        return "L" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    function showLogin() {
        loginPanel.classList.remove("hidden");
        adminPanel.classList.add("hidden");
        loginStatus.textContent = "";
        adminStatus.textContent = "";
        setScheduleStatus("");
        currentUser = null;
        currentUniversityId = null;
        editingWeekKey = null;
        editingDayKey = null;
        editingLessonId = null;
        editingGroupKey = null;
        scheduleByDay = {};
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

    // ---------- ВХОД ----------

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

    // ---------- СОХРАНЕНИЕ ИНФЫ О ВУЗЕ ----------

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

    // ---------- ВЫХОД ----------

    if (logoutButton) {
        logoutButton.addEventListener("click", function () {
            showLogin();
        });
    }

    // ---------- РАСПИСАНИЕ ----------

    function clearScheduleForm() {
        if (!scheduleDaySelect) return;

        scheduleDaySelect.value = "1";
        if (!currentUser || !currentUser.group) {
            scheduleGroupInput.value = scheduleGroupInput.value || "";
        } else {
            scheduleGroupInput.value = currentUser.group;
        }
        scheduleStartInput.value = "";
        scheduleEndInput.value = "";
        scheduleSubjectInput.value = "";
        scheduleTeacherInput.value = "";
        scheduleRoomInput.value = "";

        editingWeekKey = null;
        editingDayKey = null;
        editingLessonId = null;
        editingGroupKey = null;

        scheduleSaveButton.textContent = "Добавить в расписание";
        scheduleCancelButton.classList.add("hidden");
        setScheduleStatus("");
    }

    // чтение: universities/{universityId}/schedule/{groupId}/{weekKey}/{dayKey}
    function loadSchedule() {
        if (!currentUniversityId || !scheduleTableBody) {
            return Promise.resolve();
        }

        var weekKey = getCurrentWeekKey();
        var groupKey = getCurrentGroupKey();

        scheduleByDay = {};

        setScheduleStatus(
            "Загружаем расписание: группа " + groupKey + ", неделя " + weekKey,
            false
        );

        var daysRef = db
            .collection("universities")
            .doc(currentUniversityId)
            .collection("schedule")
            .doc(groupKey)
            .collection(weekKey);

        return daysRef
            .get()
            .then(function (snapshot) {
                snapshot.forEach(function (doc) {
                    var dayKey = doc.id; // "1".."7"
                    var data = doc.data() || {};
                    var lessons = Array.isArray(data.lessons) ? data.lessons : [];

                    lessons = lessons.map(function (lesson) {
                        if (!lesson.id) {
                            lesson.id = generateLessonId();
                        }
                        return lesson;
                    });

                    scheduleByDay[dayKey] = lessons;
                });

                renderScheduleGrouped();
                setScheduleStatus("Расписание загружено", false);
            })
            .catch(function (error) {
                console.error("Ошибка загрузки расписания:", error);
                setScheduleStatus("Ошибка загрузки: " + error.message, true);
            });
    }

    function renderScheduleGrouped() {
        if (!scheduleTableBody) return;

        scheduleTableBody.innerHTML = "";

        var weekKey = getCurrentWeekKey();
        var hasLessons = false;

        for (var day = 1; day <= 7; day++) {
            var dayKey = String(day);
            var lessons = scheduleByDay[dayKey] || [];
            if (!lessons.length) continue;

            hasLessons = true;

            var headerTr = document.createElement("tr");
            var headerTd = document.createElement("td");
            headerTd.colSpan = 7;
            headerTd.textContent = dayNames[day] + " (" + weekKey + ")";
            headerTd.style.fontWeight = "600";
            headerTd.style.paddingTop = "10px";
            headerTd.style.paddingBottom = "6px";
            headerTr.appendChild(headerTd);
            scheduleTableBody.appendChild(headerTr);

            lessons.forEach(function (lesson) {
                var tr = document.createElement("tr");

                var tdDay = document.createElement("td");
                var tdTime = document.createElement("td");
                var tdGroup = document.createElement("td");
                var tdSubject = document.createElement("td");
                var tdTeacher = document.createElement("td");
                var tdRoom = document.createElement("td");
                var tdActions = document.createElement("td");

                tdDay.textContent = "";
                tdTime.textContent =
                    (lesson.startTime || "") +
                    (lesson.endTime ? " — " + lesson.endTime : "");
                tdGroup.textContent = lesson.group || "";
                tdSubject.textContent = lesson.subject || "";
                tdTeacher.textContent = lesson.teacher || "";
                tdRoom.textContent = lesson.room || "";

                tdActions.className = "actions-cell";

                var groupKey = getCurrentGroupKey();

                var editBtn = document.createElement("button");
                editBtn.type = "button";
                editBtn.textContent = "Изм.";
                editBtn.addEventListener("click", function () {
                    startEditLesson(groupKey, weekKey, dayKey, lesson);
                });

                var deleteBtn = document.createElement("button");
                deleteBtn.type = "button";
                deleteBtn.textContent = "X";
                deleteBtn.classList.add("secondary");
                deleteBtn.addEventListener("click", function () {
                    deleteLesson(groupKey, weekKey, dayKey, lesson.id);
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

        if (!hasLessons) {
            var tr = document.createElement("tr");
            var td = document.createElement("td");
            td.colSpan = 7;
            td.textContent = "Расписание пока пустое для выбранной недели и группы.";
            tr.appendChild(td);
            scheduleTableBody.appendChild(tr);
        }
    }

    function startEditLesson(groupKey, weekKey, dayKey, lesson) {
        editingGroupKey = groupKey;
        editingWeekKey = weekKey;
        editingDayKey = dayKey;
        editingLessonId = lesson.id;

        if (scheduleWeekSelect) {
            scheduleWeekSelect.value = weekKey;
        }
        if (scheduleDaySelect) {
            scheduleDaySelect.value = dayKey;
        }
        if (scheduleGroupInput) {
            scheduleGroupInput.value = lesson.group || groupKey;
        }

        scheduleStartInput.value = lesson.startTime || "";
        scheduleEndInput.value = lesson.endTime || "";
        scheduleSubjectInput.value = lesson.subject || "";
        scheduleTeacherInput.value = lesson.teacher || "";
        scheduleRoomInput.value = lesson.room || "";

        scheduleSaveButton.textContent = "Сохранить изменения";
        scheduleCancelButton.classList.remove("hidden");
        setScheduleStatus("Редактирование пары", false);
    }

    function deleteLesson(groupKey, weekKey, dayKey, lessonId) {
        if (!currentUniversityId || !lessonId) return;

        var confirmed = window.confirm("Удалить эту пару из расписания?");
        if (!confirmed) return;

        var lessons = scheduleByDay[dayKey] || [];
        var updated = lessons.filter(function (l) { return l.id !== lessonId; });
        scheduleByDay[dayKey] = updated;

        var dayRef = db
            .collection("universities")
            .doc(currentUniversityId)
            .collection("schedule")
            .doc(groupKey)
            .collection(weekKey)
            .doc(dayKey);

        dayRef
            .set({ lessons: updated }, { merge: true })
            .then(function () {
                setScheduleStatus("Пара удалена", false);
                if (editingLessonId === lessonId) {
                    clearScheduleForm();
                }
                renderScheduleGrouped();
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

            var weekKey = editingLessonId ? editingWeekKey : getCurrentWeekKey();
            var day = parseInt(scheduleDaySelect.value, 10);
            var dayKey = editingLessonId ? editingDayKey : String(day);

            var groupTyped = scheduleGroupInput.value.trim();
            var baseGroupKey = getCurrentGroupKey();
            var groupKey = editingLessonId ? editingGroupKey : (groupTyped || baseGroupKey);

            var groupFieldValue = groupTyped || baseGroupKey;

            var startTime = scheduleStartInput.value;
            var endTime = scheduleEndInput.value;
            var subject = scheduleSubjectInput.value.trim();
            var teacher = scheduleTeacherInput.value.trim();
            var room = scheduleRoomInput.value.trim();

            if (!weekKey || !day || !groupKey || !startTime || !subject) {
                setScheduleStatus("Обязательные поля: неделя, день, группа, начало пары, предмет.", true);
                return;
            }

            var lessonId = editingLessonId || generateLessonId();

            var lessonData = {
                id: lessonId,
                group: groupFieldValue,
                startTime: startTime,
                endTime: endTime || "",
                subject: subject,
                teacher: teacher,
                room: room
            };

            var lessons = scheduleByDay[dayKey] ? scheduleByDay[dayKey].slice() : [];

            if (editingLessonId) {
                lessons = lessons.map(function (l) {
                    return l.id === lessonId ? lessonData : l;
                });
            } else {
                lessons.push(lessonData);
            }

            scheduleByDay[dayKey] = lessons;

            var dayRef = db
                .collection("universities")
                .doc(currentUniversityId)
                .collection("schedule")
                .doc(groupKey)
                .collection(weekKey)
                .doc(dayKey);

            setScheduleStatus("Сохраняем пару...", false);

            dayRef
                .set(
                    {
                        lessons: lessons,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    },
                    { merge: true }
                )
                .then(function () {
                    setScheduleStatus("Пара сохранена", false);
                    clearScheduleForm();
                    renderScheduleGrouped();
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

    // смена недели → другая ветка schedule/{group}/{week}
    if (scheduleWeekSelect) {
        scheduleWeekSelect.addEventListener("change", function () {
            clearScheduleForm();
            loadSchedule();
        });
    }

    // если поменяли группу в поле и хотим увидеть её расписание —
    // можно просто перезагрузить расписание по новой группе
    if (scheduleGroupInput) {
        scheduleGroupInput.addEventListener("change", function () {
            clearScheduleForm();
            loadSchedule();
        });
    }

    showLogin();
})();
