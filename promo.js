(function () {
  const API_BASE = window.CHORDASY_PROMO_API_BASE || "/api/promo";

  function setMessage(element, text, tone) {
    if (!element) return;
    element.textContent = text || "";
    if (tone) {
      element.dataset.tone = tone;
    } else {
      delete element.dataset.tone;
    }
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
  }

  async function apiFetch(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Request failed");
    }
    return data;
  }

  function renderGroupOptions(select, groups, placeholder) {
    if (!select) return;
    select.innerHTML = "";
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = placeholder;
    select.appendChild(emptyOption);
    groups.forEach((group) => {
      const option = document.createElement("option");
      option.value = String(group.id);
      option.textContent = `${group.name} (${group.available_count} available)`;
      select.appendChild(option);
    });
  }

  function authHeader(auth) {
    return auth ? { Authorization: `Basic ${auth}` } : {};
  }

  async function initRedeemPage() {
    const form = document.getElementById("redeem-form");
    if (!form) return;
    const inviteCode = document.getElementById("invite-code");
    const email = document.getElementById("email");
    const statusButton = document.getElementById("check-invite");
    const statusMessage = document.getElementById("redeem-status");
    const successCard = document.getElementById("redeem-success");
    const codeValue = document.getElementById("claimed-code");
    const codeMeta = document.getElementById("claimed-meta");
    const groupLabel = document.getElementById("group-status-value");
    const remainingLabel = document.getElementById("remaining-status-value");

    async function checkInvite() {
      const value = inviteCode.value.trim();
      if (!value) {
        setMessage(statusMessage, "Enter your invite code to check access.", "muted");
        return;
      }
      setMessage(statusMessage, "Checking invite code...", "muted");
      try {
        const data = await apiFetch("/redeem/status", {
          method: "POST",
          body: JSON.stringify({ inviteCode: value }),
        });
        groupLabel.textContent = data.group.name;
        remainingLabel.textContent = String(data.group.availableCount);
        setMessage(statusMessage, "Invite code is ready. Enter your email to claim a code.", "success");
      } catch (error) {
        groupLabel.textContent = "Not verified";
        remainingLabel.textContent = "0";
        successCard.hidden = true;
        setMessage(statusMessage, error.message, "error");
      }
    }

    statusButton.addEventListener("click", checkInvite);
    inviteCode.addEventListener("blur", () => {
      if (inviteCode.value.trim()) {
        checkInvite();
      }
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      successCard.hidden = true;

      const inviteValue = inviteCode.value.trim();
      const emailValue = email.value.trim().toLowerCase();
      if (!inviteValue) {
        setMessage(statusMessage, "Invite code is required.", "error");
        return;
      }
      if (!isValidEmail(emailValue)) {
        setMessage(statusMessage, "Enter a valid email address.", "error");
        return;
      }

      const submitButton = form.querySelector('button[type="submit"]');
      submitButton.disabled = true;
      setMessage(statusMessage, "Issuing your Google Play code...", "muted");
      try {
        const data = await apiFetch("/redeem/claim", {
          method: "POST",
          body: JSON.stringify({
            inviteCode: inviteValue,
            email: emailValue,
          }),
        });
        groupLabel.textContent = data.group.name;
        remainingLabel.textContent = String(data.group.availableCount);
        codeValue.textContent = data.code;
        codeMeta.textContent = data.reusedClaim
          ? `This email already claimed a code for ${data.group.name}, so the same code is shown again.`
          : `Code issued for ${emailValue}. Remaining in this group: ${data.group.availableCount}.`;
        successCard.hidden = false;
        setMessage(statusMessage, "Your code is ready.", "success");
      } catch (error) {
        setMessage(statusMessage, error.message, "error");
      } finally {
        submitButton.disabled = false;
      }
    });
  }

  async function initAdminPage() {
    const loginForm = document.getElementById("admin-login-form");
    if (!loginForm) return;

    const loginSection = document.getElementById("admin-login-section");
    const appSection = document.getElementById("admin-app");
    const loginMessage = document.getElementById("admin-login-message");
    const createGroupForm = document.getElementById("create-group-form");
    const importForm = document.getElementById("import-codes-form");
    const blacklistForm = document.getElementById("blacklist-form");
    const codesExplorerForm = document.getElementById("codes-explorer-form");
    const claimsFilterForm = document.getElementById("claims-filter-form");
    const logoutButton = document.getElementById("admin-logout");
    const refreshButton = document.getElementById("admin-refresh");
    const fileInput = document.getElementById("codes-file");

    const summaryNodes = {
      groups: document.getElementById("summary-groups"),
      available: document.getElementById("summary-available"),
      claimed: document.getElementById("summary-claimed"),
      blacklist: document.getElementById("summary-blacklist"),
    };

    const groupsTableBody = document.getElementById("groups-table-body");
    const codesTableBody = document.getElementById("codes-table-body");
    const claimsTableBody = document.getElementById("claims-table-body");
    const blacklistTableBody = document.getElementById("blacklist-table-body");

    const createGroupMessage = document.getElementById("create-group-message");
    const importMessage = document.getElementById("import-message");
    const blacklistMessage = document.getElementById("blacklist-message");
    const codesMessage = document.getElementById("codes-message");
    const claimsMessage = document.getElementById("claims-message");

    const groupSelectNodes = [
      document.getElementById("import-group-id"),
      document.getElementById("codes-group-id"),
      document.getElementById("claims-group-id"),
    ];

    let adminAuth = sessionStorage.getItem("promo_admin_auth") || "";
    let cachedGroups = [];

    function setLoggedIn(isLoggedIn) {
      loginSection.classList.toggle("promo-hidden", isLoggedIn);
      appSection.classList.toggle("promo-hidden", !isLoggedIn);
    }

    function groupOptionPlaceholder(select) {
      if (select && select.id === "claims-group-id") {
        return "All groups";
      }
      return "Select group";
    }

    async function adminFetch(path, options = {}) {
      return apiFetch(path, {
        ...options,
        headers: {
          ...authHeader(adminAuth),
          ...(options.headers || {}),
        },
      });
    }

    function fillSummary(summary) {
      summaryNodes.groups.textContent = String(summary.totalGroups);
      summaryNodes.available.textContent = String(summary.availableCodes);
      summaryNodes.claimed.textContent = String(summary.claimedCodes);
      summaryNodes.blacklist.textContent = String(summary.blacklistedEmails);
    }

    function renderGroups(groups) {
      cachedGroups = groups;
      groupSelectNodes.forEach((node) => renderGroupOptions(node, groups, groupOptionPlaceholder(node)));
      groupsTableBody.innerHTML = "";
      groups.forEach((group) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>
            <strong>${group.name}</strong><br>
            <span class="promo-field-hint">${group.slug}</span>
          </td>
          <td><span class="promo-tag ${group.is_active ? "promo-tag-active" : "promo-tag-inactive"}">${group.is_active ? "Active" : "Disabled"}</span></td>
          <td>${group.available_count}</td>
          <td>${group.claimed_count}</td>
          <td>${group.total_count}</td>
          <td>${group.last_imported_at || "-"}</td>
          <td>
            <div class="promo-toolbar">
              <button class="promo-button promo-button-secondary" data-group-toggle="${group.id}" data-active="${group.is_active ? "1" : "0"}">${group.is_active ? "Disable" : "Enable"}</button>
            </div>
          </td>
        `;
        groupsTableBody.appendChild(row);
      });

      groupsTableBody.querySelectorAll("[data-group-toggle]").forEach((button) => {
        button.addEventListener("click", async () => {
          const groupId = button.getAttribute("data-group-toggle");
          const nextActive = button.getAttribute("data-active") !== "1";
          button.disabled = true;
          try {
            await adminFetch(`/admin/groups/${groupId}`, {
              method: "PATCH",
              body: JSON.stringify({ isActive: nextActive }),
            });
            await refreshDashboard();
          } catch (error) {
            setMessage(createGroupMessage, error.message, "error");
          } finally {
            button.disabled = false;
          }
        });
      });
    }

    function renderCodes(codes) {
      codesTableBody.innerHTML = "";
      if (!codes.length) {
        const row = document.createElement("tr");
        row.innerHTML = '<td colspan="6">No codes found for this filter.</td>';
        codesTableBody.appendChild(row);
        return;
      }
      codes.forEach((code) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td><code>${code.code}</code></td>
          <td><span class="promo-tag ${code.status === "available" ? "promo-tag-available" : "promo-tag-claimed"}">${code.status}</span></td>
          <td>${code.batch_label || "-"}</td>
          <td>${code.claimed_by_email || "-"}</td>
          <td>${code.claimed_at || code.added_at || "-"}</td>
          <td>${code.status === "available" ? `<button class="promo-button promo-button-danger" data-delete-code="${code.id}">Delete</button>` : "-"}</td>
        `;
        codesTableBody.appendChild(row);
      });

      codesTableBody.querySelectorAll("[data-delete-code]").forEach((button) => {
        button.addEventListener("click", async () => {
          const codeId = button.getAttribute("data-delete-code");
          button.disabled = true;
          try {
            await adminFetch(`/admin/codes/${codeId}`, { method: "DELETE" });
            setMessage(codesMessage, "Unused code deleted.", "success");
            await loadCodes();
            await refreshSummary();
          } catch (error) {
            setMessage(codesMessage, error.message, "error");
          } finally {
            button.disabled = false;
          }
        });
      });
    }

    function renderClaims(claims) {
      claimsTableBody.innerHTML = "";
      if (!claims.length) {
        const row = document.createElement("tr");
        row.innerHTML = '<td colspan="5">No claims found.</td>';
        claimsTableBody.appendChild(row);
        return;
      }
      claims.forEach((claim) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${claim.email}</td>
          <td>${claim.group_name}</td>
          <td><code>${claim.code}</code></td>
          <td>${claim.claimed_at}</td>
          <td>${claim.invite_label || "-"}</td>
        `;
        claimsTableBody.appendChild(row);
      });
    }

    function renderBlacklist(entries) {
      blacklistTableBody.innerHTML = "";
      if (!entries.length) {
        const row = document.createElement("tr");
        row.innerHTML = '<td colspan="4">No blacklisted emails.</td>';
        blacklistTableBody.appendChild(row);
        return;
      }
      entries.forEach((entry) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${entry.email}</td>
          <td>${entry.reason || "-"}</td>
          <td>${entry.created_at}</td>
          <td><button class="promo-button promo-button-secondary" data-unblacklist="${entry.email}">Remove</button></td>
        `;
        blacklistTableBody.appendChild(row);
      });

      blacklistTableBody.querySelectorAll("[data-unblacklist]").forEach((button) => {
        button.addEventListener("click", async () => {
          const email = button.getAttribute("data-unblacklist");
          button.disabled = true;
          try {
            await adminFetch("/admin/blacklist/remove", {
              method: "POST",
              body: JSON.stringify({ email }),
            });
            setMessage(blacklistMessage, "Email removed from blacklist.", "success");
            await loadBlacklist();
            await refreshSummary();
          } catch (error) {
            setMessage(blacklistMessage, error.message, "error");
          } finally {
            button.disabled = false;
          }
        });
      });
    }

    async function refreshSummary() {
      const summary = await adminFetch("/admin/summary");
      fillSummary(summary);
    }

    async function loadGroups() {
      const groups = await adminFetch("/admin/groups");
      renderGroups(groups.groups);
    }

    async function loadCodes() {
      const groupId = document.getElementById("codes-group-id").value;
      const status = document.getElementById("codes-status").value;
      if (!groupId) {
        codesTableBody.innerHTML = '<tr><td colspan="6">Select a group to inspect codes.</td></tr>';
        return;
      }
      setMessage(codesMessage, "Loading codes...", "muted");
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      const data = await adminFetch(`/admin/groups/${groupId}/codes?${params.toString()}`);
      renderCodes(data.codes);
      setMessage(codesMessage, `Showing ${data.codes.length} codes.`, "muted");
    }

    async function loadClaims() {
      setMessage(claimsMessage, "Loading claims...", "muted");
      const params = new URLSearchParams();
      const groupId = document.getElementById("claims-group-id").value;
      const email = document.getElementById("claims-email").value.trim();
      if (groupId) params.set("groupId", groupId);
      if (email) params.set("email", email);
      const data = await adminFetch(`/admin/claims?${params.toString()}`);
      renderClaims(data.claims);
      setMessage(claimsMessage, `Showing ${data.claims.length} claim records.`, "muted");
    }

    async function loadBlacklist() {
      const data = await adminFetch("/admin/blacklist");
      renderBlacklist(data.entries);
    }

    async function refreshDashboard() {
      await refreshSummary();
      await loadGroups();
      await loadClaims();
      await loadBlacklist();
      await loadCodes();
    }

    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const username = document.getElementById("admin-username").value.trim();
      const password = document.getElementById("admin-password").value;
      if (!username || !password) {
        setMessage(loginMessage, "Enter username and password.", "error");
        return;
      }
      adminAuth = btoa(`${username}:${password}`);
      sessionStorage.setItem("promo_admin_auth", adminAuth);
      setMessage(loginMessage, "Signing in...", "muted");
      try {
        await refreshDashboard();
        setLoggedIn(true);
        setMessage(loginMessage, "", "");
      } catch (error) {
        sessionStorage.removeItem("promo_admin_auth");
        adminAuth = "";
        setMessage(loginMessage, error.message, "error");
      }
    });

    logoutButton.addEventListener("click", () => {
      sessionStorage.removeItem("promo_admin_auth");
      adminAuth = "";
      setLoggedIn(false);
    });

    refreshButton.addEventListener("click", async () => {
      try {
        await refreshDashboard();
      } catch (error) {
        setMessage(createGroupMessage, error.message, "error");
      }
    });

    createGroupForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const name = document.getElementById("group-name").value.trim();
      const inviteCode = document.getElementById("group-invite-code").value.trim();
      if (!name || !inviteCode) {
        setMessage(createGroupMessage, "Group name and invite code are required.", "error");
        return;
      }
      try {
        await adminFetch("/admin/groups", {
          method: "POST",
          body: JSON.stringify({ name, inviteCode }),
        });
        createGroupForm.reset();
        setMessage(createGroupMessage, "Group created.", "success");
        await refreshDashboard();
      } catch (error) {
        setMessage(createGroupMessage, error.message, "error");
      }
    });

    importForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const groupId = document.getElementById("import-group-id").value;
      const batchLabel = document.getElementById("batch-label").value.trim();
      const textareaValue = document.getElementById("codes-text").value.trim();
      if (!groupId) {
        setMessage(importMessage, "Choose a group before importing.", "error");
        return;
      }

      let codesText = textareaValue;
      if (!codesText && fileInput.files[0]) {
        codesText = await fileInput.files[0].text();
      }
      if (!codesText) {
        setMessage(importMessage, "Paste codes or choose a CSV file.", "error");
        return;
      }
      try {
        const result = await adminFetch(`/admin/groups/${groupId}/codes/import`, {
          method: "POST",
          body: JSON.stringify({ codesText, batchLabel }),
        });
        importForm.reset();
        setMessage(importMessage, `Imported ${result.insertedCount} new codes. ${result.skippedCount} duplicate or empty values skipped.`, "success");
        await refreshDashboard();
      } catch (error) {
        setMessage(importMessage, error.message, "error");
      }
    });

    blacklistForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = document.getElementById("blacklist-email").value.trim().toLowerCase();
      const reason = document.getElementById("blacklist-reason").value.trim();
      if (!isValidEmail(email)) {
        setMessage(blacklistMessage, "Enter a valid email.", "error");
        return;
      }
      try {
        await adminFetch("/admin/blacklist", {
          method: "POST",
          body: JSON.stringify({ email, reason }),
        });
        blacklistForm.reset();
        setMessage(blacklistMessage, "Email added to blacklist.", "success");
        await loadBlacklist();
        await refreshSummary();
      } catch (error) {
        setMessage(blacklistMessage, error.message, "error");
      }
    });

    codesExplorerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await loadCodes();
      } catch (error) {
        setMessage(codesMessage, error.message, "error");
      }
    });

    claimsFilterForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await loadClaims();
      } catch (error) {
        setMessage(claimsMessage, error.message, "error");
      }
    });

    if (adminAuth) {
      try {
        await refreshDashboard();
        setLoggedIn(true);
      } catch (error) {
        sessionStorage.removeItem("promo_admin_auth");
        adminAuth = "";
        setLoggedIn(false);
      }
    } else {
      setLoggedIn(false);
    }
  }

  if (document.body.dataset.page === "promo-redeem") {
    initRedeemPage();
  }
  if (document.body.dataset.page === "promo-admin") {
    initAdminPage();
  }
})();
