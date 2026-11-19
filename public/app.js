/* RANDOM's browser is a presentation client; game rules and authorization live on the server. */
"use strict";
const copy = {
  en: {
    tagline: "Tabletop roleplaying",
    navigation: "Main navigation",
    characterSheet: "Character sheet",
    creatureSheet: "Creature sheet",
    noValue: "Not specified",
    sheetSettings: "Sheet settings",
    currentMax: "current:maximum",
    home: "Home",
    campaigns: "Campaigns",
    characters: "Characters",
    creatures: "Creatures",
    generators: "Generators",
    dice: "Dice",
    rulebook: "Rulebook",
    admin: "Administration",
    signOut: "Sign out",
    welcome: "Your next story begins here",
    welcomeText:
      "Gather your companions, bring your characters to life, and explore the worlds of RANDOM.",
    enter: "Enter RANDOM",
    signIn: "Sign in",
    register: "Request an account",
    inviteRegister: "Create your account",
    username: "Username",
    password: "Password",
    language: "Language",
    accountPending:
      "Your request has been sent. An administrator must approve it before you can sign in.",
    accountActive: "Your account is ready. You can sign in now.",
    passwordHint: "At least 12 characters",
    usernameHint: "3–32 letters, numbers, dots, underscores or hyphens",
    resetPassword: "Set a new password",
    resetDone: "Your password has been changed. Sign in to continue.",
    adventure: "An adventure of your own",
    homeIntro:
      "A place for your adventures, your companions and the stories you make together.",
    openCampaigns: "Open your campaigns",
    begin: "Begin exploring",
    campaignIntro: "Gather around the table and keep your adventures together.",
    newCampaign: "Create campaign",
    name: "Name",
    description: "Description",
    create: "Create",
    cancel: "Cancel",
    save: "Save",
    back: "Back",
    close: "Close",
    settings: "Settings",
    noCampaigns:
      "No campaigns yet. Create one, or accept an invitation to join your companions.",
    invitations: "Invitations",
    invitedBy: "Invited by",
    accept: "Accept",
    reject: "Reject",
    overview: "Overview",
    members: "Members",
    owner: "Owner",
    gm: "GM",
    member: "Member",
    here: "In campaign",
    online: "Online elsewhere",
    offline: "Offline",
    playing: "Playing character",
    playingChoiceHint:
      "Choose a character you can control that is assigned to this campaign.",
    noCharacter: "No character selected",
    formatRules: "One per line: name:level:description",
    formatDescribed: "One per line: name:description",
    formatLines: "One entry per line",
    inviteMember: "Invite a member by username",
    invite: "Invite",
    promote: "Make GM",
    demote: "Remove GM role",
    remove: "Remove",
    leave: "Leave campaign",
    pendingAssignments: "Assignment requests",
    approve: "Approve",
    private: "Private",
    shared: "Campaign-shared",
    chat: "Session chat",
    membersOnly: "Join the campaign to use its session chat and dice.",
    message: "Write a message",
    send: "Send",
    privateRoll: "Private roll · visible to GMs",
    roll: "Roll",
    total: "Total",
    modifier: "Modifier",
    campaignSettings: "Campaign settings",
    transferOwnership: "Transfer ownership",
    transfer: "Transfer",
    cover: "Campaign cover",
    upload: "Upload",
    removeImage: "Remove image",
    deleteCampaign: "Delete campaign",
    confirmCampaign: "Type the campaign name to confirm permanent deletion.",
    yourLibrary: "Your library",
    entityIntro:
      "Keep your sheets close at hand, wherever your adventures take you.",
    newBlank: "New blank sheet",
    generateCharacter: "Generate character",
    generateCreature: "Generate creature",
    noEntities: "There are no sheets here yet.",
    viewSheet: "Open sheet",
    editing: "Editing",
    startEditing: "Start editing",
    finishEditing: "Finish editing",
    lockedBy: "Currently edited by",
    lockLost: "Your editing session ended. Unsaved text has not been saved.",
    editHint:
      "Changes save when you leave a field. Use current:maximum for paired values.",
    undo: "Undo",
    redo: "Redo",
    saveReversal: "Save reversal",
    cancelReversal: "Cancel preview",
    previewing: "Undo preview · changes are not saved",
    damage: "Damage",
    piercing: "Piercing",
    heal: "Heal",
    healResource: "Heal resource",
    percentage: "Restore to % of maximum",
    endTurn: "End turn",
    amount: "Amount",
    portrait: "Portrait",
    permissions: "Individual permissions",
    viewer: "Viewer",
    editor: "Editor",
    grant: "Grant access",
    revoke: "Revoke",
    assignments: "Campaign assignments",
    requestAssignment: "Request assignment",
    campaignReference: "Campaign ID or link, if not listed",
    request: "Request",
    withdraw: "Withdraw / remove",
    changeVisibility: "Change visibility",
    deleteEntity: "Permanently delete",
    confirmEntity: "Type the sheet name to confirm permanent deletion.",
    entityDeleted: "Sheet deleted.",
    saved: "Saved",
    invalid: "Please check the value and try again.",
    generationIntro:
      "Follow a path through the RANDOM tables, or let chance choose for you.",
    chooseCategory: "Choose a category",
    randomChoice: "Random selection",
    entries: "Choose a specific entry",
    fields: "Choose a field",
    generate: "Generate",
    regenerate: "Regenerate",
    generationLanguage: "Generation language",
    level: "Level",
    random: "Random",
    generationPath: "Background / type",
    generatedPreview: "Generated preview",
    saveToLibrary: "Save to library",
    noPreview: "Generate a result to preview it here.",
    modifiers: "Modifiers",
    result: "Result",
    diceIntro:
      "The dice are rolled on the server. Personal rolls stay with you.",
    expression: "Dice expression",
    diceExample: "For example: 1d20, 2d6+3, 4d8-2",
    personalRoll: "Personal roll",
    rulebookIntro:
      "Read the original illustrated rules, complete with their search and navigation tools.",
    edition: "Edition",
    openEdition: "Open edition in a new window",
    administration: "Website administration",
    accounts: "Accounts",
    accountRequests: "Account requests",
    active: "Active",
    pending: "Pending",
    rejected: "Rejected",
    disabled: "Disabled",
    user: "User",
    makeAdmin: "Make admin",
    makeUser: "Make user",
    disable: "Disable",
    enable: "Enable",
    inviteLinks: "Invitation links",
    createInvite: "Create single-use link",
    resetLink: "Create password-reset link",
    createdLink: "Copy this link",
    expires: "Expires",
    noInvitations: "No active invitations.",
    imageHint: "PNG, JPEG or WebP, up to 4 MB.",
    uploadError: "The image must be a PNG, JPEG or WebP under 4 MB.",
    confirm: "Confirm",
    onlineStatus: "Presence",
    status: "Status",
    requestSent: "Request sent.",
    next: "Continue",
    noResults: "No options at this level.",
    unnamed: "Untitled",
    waiting: "Please wait…",
    selected: "Selected",
    choose: "Choose",
    noHistory: "There are no more saved changes to undo.",
    UNDO_PREVIEW_ACTIVE: "Save or cancel the undo preview first.",
    LOGIN_FAILED:
      "Incorrect username or password, or the account is not active.",
    LOGIN_REQUIRED: "Please sign in again.",
    USERNAME_REQUIREMENTS: "Please check the username requirements.",
    PASSWORD_REQUIREMENTS: "Passwords must contain at least 12 characters.",
    USERNAME_TAKEN: "That username is already in use.",
    INVITATION_INVALID: "This invitation is invalid or has already been used.",
    RESET_INVALID: "This reset link is invalid or expired.",
    TOO_MANY_ATTEMPTS: "Too many attempts. Please try again later.",
    FORBIDDEN: "You do not have permission to do that.",
    LOCKED: "This sheet is currently being edited by someone else.",
    LOCK_REQUIRED: "Your editing session has ended.",
    VERSION_CONFLICT: "The sheet changed. Reload it before trying again.",
    CHARACTER_INELIGIBLE:
      "The character must be assigned to this campaign and controllable by that member.",
    CHARACTER_ALREADY_PLAYING:
      "Another member has already selected that character.",
    ALREADY_ASSIGNED: "An assignment or request already exists.",
    INVALID_IMAGE: "Please choose a valid PNG, JPEG or WebP under 4 MB.",
    NO_MORE_UNDO: "There are no more changes to undo.",
    NO_MORE_REDO: "There are no more changes to redo.",
    USER_NOT_FOUND: "That active user could not be found.",
    CAMPAIGN_NOT_FOUND: "That campaign could not be found.",
    LAST_ADMIN: "At least one active administrator must remain.",
    CONFIRMATION_REQUIRED: "The confirmation does not match the name.",
    INTERNAL_ERROR: "Something went wrong. Please try again.",
  },
  fr: {
    tagline: "Jeu de rôle sur table",
    navigation: "Navigation principale",
    characterSheet: "Fiche de personnage",
    creatureSheet: "Fiche de créature",
    noValue: "Non renseigné",
    sheetSettings: "Gestion de la fiche",
    currentMax: "actuel:maximum",
    home: "Accueil",
    campaigns: "Campagnes",
    characters: "Personnages",
    creatures: "Créatures",
    generators: "Générateurs",
    dice: "Dés",
    rulebook: "Livre de règles",
    admin: "Administration",
    signOut: "Déconnexion",
    welcome: "Votre prochaine histoire commence ici",
    welcomeText:
      "Rassemblez vos compagnons, donnez vie à vos personnages et explorez les mondes de RANDOM.",
    enter: "Entrer dans RANDOM",
    signIn: "Se connecter",
    register: "Demander un compte",
    inviteRegister: "Créer votre compte",
    username: "Nom d’utilisateur",
    password: "Mot de passe",
    language: "Langue",
    accountPending:
      "Votre demande a été envoyée. Un administrateur doit l’approuver avant votre connexion.",
    accountActive:
      "Votre compte est prêt. Vous pouvez maintenant vous connecter.",
    passwordHint: "Au moins 12 caractères",
    usernameHint:
      "3 à 32 lettres, chiffres, points, tirets ou traits de soulignement",
    resetPassword: "Choisir un nouveau mot de passe",
    resetDone:
      "Votre mot de passe a été modifié. Connectez-vous pour continuer.",
    adventure: "Une aventure à votre image",
    homeIntro:
      "Un lieu pour vos aventures, vos compagnons et les histoires que vous créez ensemble.",
    openCampaigns: "Ouvrir vos campagnes",
    begin: "Commencer à explorer",
    campaignIntro:
      "Retrouvez-vous autour de la table et rassemblez vos aventures.",
    newCampaign: "Créer une campagne",
    name: "Nom",
    description: "Description",
    create: "Créer",
    cancel: "Annuler",
    save: "Enregistrer",
    back: "Retour",
    close: "Fermer",
    settings: "Paramètres",
    noCampaigns:
      "Aucune campagne pour le moment. Créez-en une ou acceptez une invitation.",
    invitations: "Invitations",
    invitedBy: "Invitation de",
    accept: "Accepter",
    reject: "Refuser",
    overview: "Vue d’ensemble",
    members: "Membres",
    owner: "Propriétaire",
    gm: "MJ",
    member: "Membre",
    here: "Dans la campagne",
    online: "En ligne ailleurs",
    offline: "Hors ligne",
    playing: "Personnage joué",
    playingChoiceHint:
      "Choisissez un personnage que vous pouvez contrôler et qui est affecté à cette campagne.",
    noCharacter: "Aucun personnage sélectionné",
    formatRules: "Une par ligne : nom:niveau:description",
    formatDescribed: "Un par ligne : nom:description",
    formatLines: "Une entrée par ligne",
    inviteMember: "Inviter un membre par son nom d’utilisateur",
    invite: "Inviter",
    promote: "Nommer MJ",
    demote: "Retirer le rôle de MJ",
    remove: "Retirer",
    leave: "Quitter la campagne",
    pendingAssignments: "Demandes d’affectation",
    approve: "Approuver",
    private: "Privé",
    shared: "Partagé dans la campagne",
    chat: "Discussion de séance",
    membersOnly:
      "Rejoignez la campagne pour utiliser la discussion et les dés de séance.",
    message: "Écrire un message",
    send: "Envoyer",
    privateRoll: "Jet privé · visible par les MJ",
    roll: "Lancer",
    total: "Total",
    modifier: "Modificateur",
    campaignSettings: "Paramètres de la campagne",
    transferOwnership: "Transférer la propriété",
    transfer: "Transférer",
    cover: "Couverture de la campagne",
    upload: "Importer",
    removeImage: "Retirer l’image",
    deleteCampaign: "Supprimer la campagne",
    confirmCampaign:
      "Saisissez le nom de la campagne pour confirmer sa suppression définitive.",
    yourLibrary: "Votre bibliothèque",
    entityIntro:
      "Gardez vos fiches à portée de main, où que vous mène l’aventure.",
    newBlank: "Nouvelle fiche vierge",
    generateCharacter: "Générer un personnage",
    generateCreature: "Générer une créature",
    noEntities: "Il n’y a pas encore de fiche ici.",
    viewSheet: "Ouvrir la fiche",
    editing: "Modification",
    startEditing: "Modifier",
    finishEditing: "Terminer les modifications",
    lockedBy: "En cours de modification par",
    lockLost:
      "Votre session de modification est terminée. Le texte non enregistré n’a pas été sauvegardé.",
    editHint:
      "Les changements sont enregistrés lorsque vous quittez un champ. Pour les valeurs associées : actuel:maximum.",
    undo: "Annuler",
    redo: "Rétablir",
    saveReversal: "Enregistrer la révision",
    cancelReversal: "Annuler l’aperçu",
    previewing:
      "Aperçu de la révision · les changements ne sont pas enregistrés",
    damage: "Dégâts",
    piercing: "Perforant",
    heal: "Soigner",
    healResource: "Ressource à soigner",
    percentage: "Restaurer à % du maximum",
    endTurn: "Fin du tour",
    amount: "Quantité",
    portrait: "Portrait",
    permissions: "Autorisations individuelles",
    viewer: "Lecteur",
    editor: "Éditeur",
    grant: "Autoriser",
    revoke: "Révoquer",
    assignments: "Affectations aux campagnes",
    requestAssignment: "Demander une affectation",
    campaignReference: "Identifiant ou lien de campagne si elle n’apparaît pas",
    request: "Demander",
    withdraw: "Retirer",
    changeVisibility: "Changer la visibilité",
    deleteEntity: "Supprimer définitivement",
    confirmEntity:
      "Saisissez le nom de la fiche pour confirmer sa suppression définitive.",
    entityDeleted: "Fiche supprimée.",
    saved: "Enregistré",
    invalid: "Vérifiez la valeur et réessayez.",
    generationIntro:
      "Parcourez les tables RANDOM ou laissez le hasard choisir pour vous.",
    chooseCategory: "Choisir une catégorie",
    randomChoice: "Sélection aléatoire",
    entries: "Choisir une entrée précise",
    fields: "Choisir un champ",
    generate: "Générer",
    regenerate: "Regénérer",
    generationLanguage: "Langue de génération",
    level: "Niveau",
    random: "Aléatoire",
    generationPath: "Historique / type",
    generatedPreview: "Aperçu généré",
    saveToLibrary: "Enregistrer dans la bibliothèque",
    noPreview: "Générez un résultat pour le consulter ici.",
    modifiers: "Modificateurs",
    result: "Résultat",
    diceIntro:
      "Les dés sont lancés par le serveur. Les jets personnels restent privés.",
    expression: "Expression de dé",
    diceExample: "Par exemple : 1d20, 2d6+3, 4d8-2",
    personalRoll: "Jet personnel",
    rulebookIntro:
      "Lisez le livre de règles illustré d’origine, avec sa recherche et sa navigation.",
    edition: "Édition",
    openEdition: "Ouvrir dans une nouvelle fenêtre",
    administration: "Administration du site",
    accounts: "Comptes",
    accountRequests: "Demandes de compte",
    active: "Actif",
    pending: "En attente",
    rejected: "Refusé",
    disabled: "Désactivé",
    user: "Utilisateur",
    makeAdmin: "Nommer administrateur",
    makeUser: "Retirer le rôle administrateur",
    disable: "Désactiver",
    enable: "Activer",
    inviteLinks: "Liens d’invitation",
    createInvite: "Créer un lien à usage unique",
    resetLink: "Créer un lien de réinitialisation",
    createdLink: "Copiez ce lien",
    expires: "Expire",
    noInvitations: "Aucune invitation active.",
    imageHint: "PNG, JPEG ou WebP, 4 Mo maximum.",
    uploadError: "L’image doit être un PNG, JPEG ou WebP de moins de 4 Mo.",
    confirm: "Confirmer",
    onlineStatus: "Présence",
    status: "Statut",
    requestSent: "Demande envoyée.",
    next: "Continuer",
    noResults: "Aucune option à ce niveau.",
    unnamed: "Sans nom",
    waiting: "Veuillez patienter…",
    selected: "Sélectionné",
    choose: "Choisir",
    noHistory: "Il n’y a plus de modification à annuler.",
    UNDO_PREVIEW_ACTIVE: "Enregistrez ou annulez d’abord l’aperçu de révision.",
    LOGIN_FAILED:
      "Nom d’utilisateur ou mot de passe incorrect, ou compte inactif.",
    LOGIN_REQUIRED: "Veuillez vous reconnecter.",
    USERNAME_REQUIREMENTS: "Vérifiez les conditions du nom d’utilisateur.",
    PASSWORD_REQUIREMENTS:
      "Le mot de passe doit comporter au moins 12 caractères.",
    USERNAME_TAKEN: "Ce nom d’utilisateur est déjà utilisé.",
    INVITATION_INVALID: "Cette invitation est invalide ou déjà utilisée.",
    RESET_INVALID: "Ce lien est invalide ou expiré.",
    TOO_MANY_ATTEMPTS: "Trop de tentatives. Réessayez plus tard.",
    FORBIDDEN: "Vous n’avez pas l’autorisation nécessaire.",
    LOCKED: "Cette fiche est déjà en cours de modification.",
    LOCK_REQUIRED: "Votre session de modification est terminée.",
    VERSION_CONFLICT: "La fiche a changé. Rechargez-la avant de réessayer.",
    CHARACTER_INELIGIBLE:
      "Le personnage doit être affecté à cette campagne et contrôlable par ce membre.",
    CHARACTER_ALREADY_PLAYING:
      "Un autre membre a déjà sélectionné ce personnage.",
    ALREADY_ASSIGNED: "Une affectation ou une demande existe déjà.",
    INVALID_IMAGE: "Choisissez un PNG, JPEG ou WebP valide de moins de 4 Mo.",
    NO_MORE_UNDO: "Il n’y a plus de modification à annuler.",
    NO_MORE_REDO: "Il n’y a plus de modification à rétablir.",
    USER_NOT_FOUND: "Utilisateur actif introuvable.",
    CAMPAIGN_NOT_FOUND: "Campagne introuvable.",
    LAST_ADMIN: "Il doit rester au moins un administrateur actif.",
    CONFIRMATION_REQUIRED: "La confirmation ne correspond pas au nom.",
    INTERNAL_ERROR: "Une erreur s’est produite. Réessayez.",
  },
};
const state = {
  user: null,
  csrf: null,
  locale: {},
  language: localStorage.getItem("random-language") === "fr" ? "fr" : "en",
  tab: crypto.randomUUID(),
  stream: null,
  streamCampaign: undefined,
  screen: "",
  campaign: null,
  sheet: null,
  editing: false,
  preview: false,
  saveQueue: Promise.resolve(),
  generation: {
    kind: "general",
    path: "",
    language: null,
    preview: null,
    result: null,
  },
};
const app = document.querySelector("#app");
const masthead = document.querySelector("#masthead");
const t = (key) => copy[state.language][key] || key;
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const attr = esc;
const fieldLabel = (key) =>
  key.split(".").reduce((node, part) => node && node[part], state.locale) ||
  key.split(".").at(-1).replace(/_/g, " ");
function notify(message, error = false) {
  const box = document.querySelector("#notice");
  box.textContent = message;
  box.className = `show${error ? " error" : ""}`;
  clearTimeout(box.timer);
  box.timer = setTimeout(() => {
    box.className = "";
  }, 5000);
}
function errorMessage(error) {
  const key = error.message || "INTERNAL_ERROR";
  return t(key) === key
    ? fieldLabel(key) === key
      ? t("invalid")
      : fieldLabel(key)
    : t(key);
}
async function api(path, method = "GET", data) {
  const options = { method, credentials: "same-origin", headers: {} };
  if (method !== "GET") {
    options.headers["Content-Type"] = "application/json";
    if (state.csrf) options.headers["X-CSRF-Token"] = state.csrf;
    options.body = JSON.stringify(data || {});
  }
  const response = await fetch(path, options);
  const payload = await response
    .json()
    .catch(() => ({ error: "INTERNAL_ERROR" }));
  if (!response.ok) throw new Error(payload.error || "INTERNAL_ERROR");
  return payload;
}
function tag(label, cls = "") {
  return `<span class="pill ${cls}">${esc(label)}</span>`;
}
function action(label, actionName, value = "", cls = "secondary") {
  return `<button type="button" class="${cls}" data-action="${attr(actionName)}" data-value="${attr(value)}">${esc(label)}</button>`;
}
function header(title, description = "", buttons = "") {
  return `<header class="page-head"><div><h1>${esc(title)}</h1>${description ? `<p>${esc(description)}</p>` : ""}</div>${buttons ? `<div class="actions">${buttons}</div>` : ""}</header>`;
}
function input(label, name, value = "", options = "") {
  return `<label>${esc(label)}<input name="${attr(name)}" value="${attr(value)}" ${options}></label>`;
}
function langSelect(name = "language", value = state.language) {
  return `<select name="${name}" aria-label="${attr(t("language"))}"><option value="en" ${value === "en" ? "selected" : ""}>English</option><option value="fr" ${value === "fr" ? "selected" : ""}>Français</option></select>`;
}
function mast() {
  const nav = [
    "home",
    "campaigns",
    "characters",
    "creatures",
    "generators",
    "dice",
    "rulebook",
  ];
  if (state.user?.role === "admin") nav.push("admin");
  const links = nav.map((n) =>
    `<a href="#/${n}" ${state.screen === n ? 'class="active" aria-current="page"' : ""}>${esc(t(n))}</a>`
  ).join("");
  masthead.innerHTML = `<div class="mast-inner">
    <a class="brand" href="#/home">RANDOM<small>${esc(t("tagline"))}</small></a>
    ${state.user ? `<nav class="main-nav" aria-label="${attr(t("navigation"))}">${links}</nav>` : ""}
    <div class="account">${state.user ? `<span class="username" title="${attr(state.user.username)}">${esc(state.user.username)}</span>` : ""}
    ${langSelect("siteLanguage")}${state.user ? `<button class="secondary" data-action="logout">${esc(t("signOut"))}</button>` : ""}</div></div>`;
  document.documentElement.lang = state.language;
  document.title = `RANDOM · ${t("tagline")}`;
  document.querySelector("#footer-tagline").textContent = t("tagline");
}
function authScreen(mode = "login", status = "") {
  state.screen = "auth";
  mast();
  const params = new URLSearchParams(location.search),
    invite = params.get("invite"),
    reset = params.get("reset");
  if (reset) mode = "reset";
  else if (invite && mode === "login") mode = "register";
  const title =
    mode === "login"
      ? t("signIn")
      : mode === "reset"
        ? t("resetPassword")
        : invite
          ? t("inviteRegister")
          : t("register");
  app.innerHTML = `<div class="auth-layout"><div class="auth-art"><div class="auth-copy"><h2>${esc(t("welcome"))}</h2><p>${esc(t("welcomeText"))}</p></div><img src="/media/journey-1000.webp" srcset="/media/journey-1000.webp 1000w, /media/journey.webp 1672w" sizes="(max-width: 720px) 100vw, 50vw" alt=""></div><div class="auth-form"><h1>${esc(title)}</h1>${status ? `<p class="warning">${esc(status)}</p>` : ""}<form id="auth-form" data-mode="${mode}">${mode !== "reset" ? input(t("username"), "username", "", 'required autocomplete="username" minlength="3" maxlength="32"') : ""}${mode === "register" ? `<small>${esc(t("usernameHint"))}</small>` : ""}${input(t("password"), "password", "", 'required minlength="12" type="password" autocomplete="' + (mode === "login" ? "current-password" : "new-password") + '"')}${mode !== "login" ? `<small>${esc(t("passwordHint"))}</small>` : ""}${mode === "register" ? `<label>${esc(t("language"))}${langSelect()}</label>` : ""}<p><button class="full">${esc(title)}</button></p></form><div class="divider">✦</div>${mode === "login" ? action(t("register"), "auth-mode", "register", "plain") : !reset ? action(t("signIn"), "auth-mode", "login", "plain") : ""}</div></div>`;
}
function homeScreen() {
  const destinations = [
    ["characters", "characters"],
    ["creatures", "combat"],
    ["generators", "loot"],
    ["dice", "dice"],
    ["rulebook", "cover"],
  ];
  app.innerHTML = `<section class="hero paper"><div class="hero-copy"><h1>${esc(t("adventure"))}</h1><p>${esc(t("homeIntro"))}</p><a class="button" href="#/campaigns">${esc(t("openCampaigns"))}</a></div><img class="hero-art" src="/media/journey-1000.webp" srcset="/media/journey-1000.webp 1000w, /media/journey.webp 1672w" sizes="(max-width: 720px) 100vw, 50vw" alt=""></section>
    <section class="shortcuts"><h2 class="ruled-title">${esc(t("begin"))}</h2><div class="shortcut-grid">${destinations.map(([page, art]) =>
      `<a class="card shortcut" href="#/${page}"><img src="/media/${art}-card.webp" alt=""><span class="shortcut-title">${esc(t(page))}<span aria-hidden="true">→</span></span></a>`
    ).join("")}</div></section>`;
}
function imageFor(type, id, portrait, extra = "") {
  if (
    !extra &&
    state.preview &&
    state.sheet?.id === id &&
    state.sheet.previewPortrait
  )
    extra = `?preview=1&tab=${encodeURIComponent(state.tab)}`;
  return portrait
    ? `/api/entities/${encodeURIComponent(id)}/portrait${extra}`
    : `/media/${type === "creature" ? "combat" : "characters"}-card.webp`;
}
function entityCard(e, campaign = "") {
  const query = campaign ? `?campaign=${encodeURIComponent(campaign)}` : "";
  return `<article class="card entity-card"><a href="#/sheet/${attr(e.id)}${query}">
    <img class="card-art" src="${attr(imageFor(e.type, e.id, e.portrait))}" alt="">
    <div class="card-body"><div class="eyebrow">${esc(t(e.type === "character" ? "characterSheet" : "creatureSheet"))}</div>
    <h2>${esc(e.name)}</h2><span class="card-link">${esc(t("viewSheet"))}<span aria-hidden="true">→</span></span></div>
    </a></article>`;
}
async function campaignList() {
  const data = await api("/api/campaigns");
  app.innerHTML = `${header(t("campaigns"), t("campaignIntro"), action(t("newCampaign"), "show-new-campaign", "", ""))}<section id="new-campaign" class="paper" hidden><h2>${esc(t("newCampaign"))}</h2><form id="create-campaign">${input(t("name"), "name", "", 'required maxlength="120"')}<label>${esc(t("description"))}<textarea name="description" maxlength="4000"></textarea></label><label>${esc(t("language"))}${langSelect()}</label><p><button>${esc(t("create"))}</button></p></form></section>${data.invitations.length ? `<section class="paper"><h2>${esc(t("invitations"))}</h2><div class="list">${data.invitations.map((i) => `<div class="list-row"><div class="grow"><strong>${esc(i.name)}</strong><p class="muted">${esc(t("invitedBy"))} ${esc(i.invitedBy)}</p></div>${action(t("accept"), "campaign-invite", `${i.id}|accept`)}${action(t("reject"), "campaign-invite", `${i.id}|reject`)}</div>`).join("")}</div></section><div class="divider">✦</div>` : ""}${data.campaigns.length ? `<div class="grid">${data.campaigns.map((c) => `<article class="card"><img class="cover" src="${c.cover ? `/api/campaigns/${attr(c.id)}/cover` : "/media/journey-1000.webp"}" alt=""><div class="card-body"><h3>${esc(c.name)}</h3><p>${esc(c.description)}</p><p>${tag(c.role === "gm" ? t("gm") : c.role ? t("member") : t("owner"))}</p><a href="#/campaign/${attr(c.id)}/overview">${esc(t("overview"))}</a></div></article>`).join("")}</div>` : `<div class="empty">${esc(t("noCampaigns"))}</div>`}`;
}
function resourcePills(resources) {
  return `<div class="resources">${["hp", "ar", "ap", "md"].map((key) => {
    const label = fieldLabel(`character.resources.${key}.name`);
    const short = fieldLabel(`character.resources.${key}.abbreviation`);
    return `<span class="resource" title="${attr(label)}"><span class="resource-label"><abbr title="${attr(label)}">${esc(short)}</abbr><span class="resource-name">${esc(label)}</span></span>
      <span class="resource-value"><b>${esc(resources[key].current)}</b> / ${esc(resources[key].max)}</span></span>`;
  }).join("")}</div>`;
}
function diceDisplay(r) {
  const illustrated = [4, 6, 8, 10, 12, 20].includes(r.sides);
  const faces = r.animation
    ? `<img src="/media/${attr(r.animation)}" alt="${attr(r.rolls[0])}">`
    : r.rolls
        .map((n) =>
          illustrated
            ? `<span class="illustrated-die"><img src="/media/die-d${attr(r.sides)}.webp" alt=""><strong>${esc(n)}</strong></span>`
            : `<span class="die-number">${esc(n)}</span>`,
        )
        .join("");
  return `<div class="dice-result">${faces}<div><div class="eyebrow">${esc(r.normalized)}</div><div>${esc(r.rolls.join(" + "))}${r.modifier ? ` ${r.modifier > 0 ? "+" : "−"} ${esc(Math.abs(r.modifier))} (${esc(t("modifier"))})` : ""}</div><strong class="result-total">${esc(t("total"))}: ${esc(r.total)}</strong></div></div>`;
}
function chatMessage(item) {
  const who = item.identity?.characterName
    ? `${item.identity.characterName} (${item.identity.username})`
    : item.identity?.username || "";
  const content =
    item.type === "text"
      ? `<p>${esc(item.text)}</p>`
      : item.type === "roll"
        ? `${item.privateRoll ? tag(t("private")) : ""}${diceDisplay(item.result)}`
        : `<p><strong>${esc(item.entityName)}</strong> · ${esc(t(item.action === "end-turn" ? "endTurn" : item.action === "resource" ? "status" : item.action))}</p>${item.resources ? resourcePills(item.resources) : ""}`;
  return `<div class="chat-message"><strong>${esc(who)}</strong> <small>${esc(new Date(item.time).toLocaleTimeString(state.language, { hour: "2-digit", minute: "2-digit" }))}</small>${content}</div>`;
}
function memberList(data, interactive = false) {
  const c = data.campaign;
  const chars = data.gm
    ? data.entities.filter((e) => e.type === "character")
    : data.controlledCharacters || [];
  return `<div class="list">${data.members
    .map((m) => {
      const p = m.playing;
      const name = p ? `${p.name} (${m.username})` : m.username;
      const status = data.presence[m.id] || "offline";
      const select =
        data.gm || m.id === state.user.id
          ? `<label>${esc(t("playing"))}<select data-playing="${attr(m.id)}"><option value="">${esc(t("noCharacter"))}</option>${chars
              .filter((e) => data.gm || e.canEdit)
              .map(
                (e) =>
                  `<option value="${attr(e.id)}" ${p?.id === e.id ? "selected" : ""}>${esc(e.name)}</option>`,
              )
              .join(
                "",
              )}</select>${data.gm ? "" : `<small>${esc(t("playingChoiceHint"))}</small>`}</label>`
          : "";
      const roleButtons = interactive
        ? `${data.manage ? action(m.role === "gm" ? t("demote") : t("promote"), "member-role", `${m.id}|${m.role === "gm" ? "demote" : "promote"}`) : ""}${data.manage || (data.gm && m.role !== "gm") || m.id === state.user.id ? action(m.id === state.user.id ? t("leave") : t("remove"), "member-role", `${m.id}|remove`) : ""}`
        : "";
      return `<div class="list-row"><span class="presence ${attr(status)}" title="${attr(t(status))}"></span><div class="grow"><details class="member-preview"><summary><strong>${esc(name)}</strong> ${tag(m.role === "gm" ? t("gm") : t("member"))} ${c.ownerId === m.id ? tag(t("owner")) : ""}</summary>${p ? `<div class="row" style="align-items:start;margin-top:.7rem"><img class="portrait fit" src="${attr(imageFor("character", p.id, p.portrait, `?previewCampaign=${encodeURIComponent(c.id)}`))}" alt=""><div><p><strong>${esc(p.name)}</strong> (${esc(m.username)}) · ${esc(t("level"))} ${esc(p.level)}</p><p>${esc(p.description)}</p>${resourcePills(p.resources)}</div></div>` : `<p class="muted">${esc(t("noCharacter"))}</p>`}</details>${interactive ? select : ""}</div>${roleButtons ? `<div class="actions">${roleButtons}</div>` : ""}</div>`;
    })
    .join("")}</div>`;
}
function campaignTabs(id, selected) {
  const tabs = ["overview", "members", "characters", "creatures", "settings"];
  return `<nav class="tabs">${tabs.map((x) => `<a ${x === selected ? 'class="active" aria-current="page"' : ""} href="#/campaign/${attr(id)}/${x}">${esc(t(x))}</a>`).join("")}</nav>`;
}
async function campaignScreen(campaignId, tabName) {
  const data = await api(`/api/campaigns/${encodeURIComponent(campaignId)}`);
  if (tabName === "members" && data.membership && !data.gm)
    data.controlledCharacters = (
      await api("/api/entities?type=character")
    ).entities.filter((entity) => entity.canEdit);
  state.campaign = data;
  const c = data.campaign,
    tabs = campaignTabs(c.id, tabName);
  const top = `${header(c.name, c.description, `<a class="button secondary" href="#/generators?campaign=${attr(c.id)}">${esc(t("generators"))}</a> <a class="button secondary" href="#/campaigns">${esc(t("back"))}</a>`)}${tabs}`;
  if (tabName === "overview") {
    app.innerHTML =
      top +
      `<div class="split"><section class="panel"><h2>${esc(t("chat"))}</h2><div class="chat" id="chat">${data.chat.map(chatMessage).join("")}</div><form id="chat-form" class="row"><label>${esc(t("message"))}<input name="text" maxlength="2000" required autocomplete="off"></label><button class="fit">${esc(t("send"))}</button></form><div class="divider">✦</div><h3>${esc(t("dice"))}</h3><form id="dice-form" class="row"><label>${esc(t("expression"))}<input name="expression" value="1d20" required></label><label class="fit"><input type="checkbox" name="private"> ${esc(t("privateRoll"))}</label><button class="fit">${esc(t("roll"))}</button></form></section><aside class="stack"><section class="panel"><h2>${esc(t("members"))}</h2>${memberList(data)}</section><section class="panel"><h2>${esc(t("characters"))} &amp; ${esc(t("creatures"))}</h2>${data.entities.length ? data.entities.map((e) => `<p><a href="#/sheet/${attr(e.id)}?campaign=${attr(c.id)}">${esc(e.name)}</a></p>`).join("") : `<p class="muted">${esc(t("noEntities"))}</p>`}</section></aside></div>`;
    const chat = document.querySelector("#chat");
    if (!data.membership && state.user.role !== "admin") {
      document.querySelector("#chat-form").remove();
      document.querySelector("#dice-form").remove();
      const message = document.createElement("p");
      message.className = "muted";
      message.textContent = t("membersOnly");
      chat.replaceChildren(message);
    }
    chat.scrollTop = chat.scrollHeight;
  } else if (tabName === "members") {
    app.innerHTML =
      top +
      `<section class="paper"><h2>${esc(t("members"))}</h2>${memberList(data, true)}${data.gm || data.manage ? `<div class="divider">✦</div><form id="campaign-invite-form" class="row"><label>${esc(t("inviteMember"))}<input name="username" required></label><button class="fit">${esc(t("invite"))}</button></form>` : ""}</section>`;
  } else if (tabName === "characters" || tabName === "creatures") {
    const type = tabName === "characters" ? "character" : "creature";
    const entities = data.entities.filter((e) => e.type === type);
    const pending = data.pending.filter((e) => e.type === type);
    app.innerHTML =
      top +
      `${pending.length ? `<section class="paper"><h2>${esc(t("pendingAssignments"))}</h2>${pending.map((e) => `<div class="list-row"><div class="grow"><strong>${esc(e.name)}</strong> · ${esc(e.owner)} ${tag(t(e.visibility))}</div>${action(t("approve"), "assignment-action", `${e.id}|approve`)}${action(t("reject"), "assignment-action", `${e.id}|remove`)}</div>`).join("")}</section><div class="divider">✦</div>` : ""}${entities.length ? `<div class="grid">${entities.map((e) => `<div>${entityCard(e, c.id)}${data.gm ? action(t("remove"), "assignment-action", `${e.id}|remove`) : ""}</div>`).join("")}</div>` : `<div class="empty">${esc(t("noEntities"))}</div>`}`;
  } else {
    const mayEdit = data.gm || data.manage;
    app.innerHTML =
      top +
      `<div class="grid two">${mayEdit ? `<section class="paper"><h2>${esc(t("campaignSettings"))}</h2><form id="campaign-settings">${input(t("name"), "name", c.name, 'required maxlength="120"')}<label>${esc(t("description"))}<textarea name="description" maxlength="4000">${esc(c.description)}</textarea></label><label>${esc(t("language"))}${langSelect("language", c.language)}</label><p><button>${esc(t("save"))}</button></p></form><div class="divider">✦</div><h3>${esc(t("cover"))}</h3><p class="muted">${esc(t("imageHint"))}</p><form id="campaign-cover-form"><input type="file" name="image" accept="image/png,image/jpeg,image/webp" required><p><button>${esc(t("upload"))}</button> ${action(t("removeImage"), "campaign-cover-remove")}</p></form></section>` : ""}${data.manage ? `<section class="paper"><h2>${esc(t("transferOwnership"))}</h2><form id="campaign-transfer">${input(t("username"), "username", "", "required")}<p><button>${esc(t("transfer"))}</button></p></form><div class="divider">✦</div><h3 class="danger">${esc(t("deleteCampaign"))}</h3><p>${esc(t("confirmCampaign"))}</p><form id="campaign-delete">${input(t("name"), "confirm", "", "required")}<p><button>${esc(t("deleteCampaign"))}</button></p></form></section>` : ""}</div>`;
  }
}
async function libraryScreen(type) {
  const data = await api(`/api/entities?type=${type}`);
  const title = t(type === "character" ? "characters" : "creatures");
  app.innerHTML = `${header(title, t("entityIntro"), `${action(t("newBlank"), "new-entity", type, "")} <a class="button secondary" href="#/generators?kind=${type}">${esc(t(type === "character" ? "generateCharacter" : "generateCreature"))}</a>`)}${data.entities.length ? `<div class="grid">${data.entities.map((e) => entityCard(e)).join("")}</div>` : `<div class="empty">${esc(t("noEntities"))}</div>`}`;
}
function sheetValue(field, section, data, value) {
  if (value == null || value === "")
    return `<span class="muted" aria-hidden="true">—</span><span class="sr-only">${esc(t("noValue"))}</span>`;
  if (field.pair) return esc(String(value).replace(":", " / "));
  if (field.format) {
    const entries = section.kind === "multiline"
      ? data[section.id]
      : field.id.split(".").reduce((record, key) => record?.[key], data);
    if (Array.isArray(entries))
      return `<ul class="sheet-entries">${entries.map((entry) => {
        if (typeof entry === "string") return `<li>${esc(entry)}</li>`;
        const level = entry.level == null ? "" : ` <small>${esc(t("level"))} ${esc(entry.level)}</small>`;
        return `<li><strong>${esc(entry.name)}</strong>${level}<div>${esc(entry.description)}</div></li>`;
      }).join("")}</ul>`;
  }
  return esc(value);
}
function sectionMarkup(section, data, enabled) {
  const fields = ["multi", "named-lines"].includes(section.kind)
    ? section.fields
    : [
        section.fields[0] || {
          id: section.id,
          labelKey: section.labelKey,
          paragraph: section.kind !== "scalar",
        },
      ];
  const statistics =
    section.kind === "named-lines"
      ? Object.fromEntries(
          section.value.split("\n").map((line) => {
            const at = line.indexOf(":");
            return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
          }),
        )
      : null;
  const title = fieldLabel(section.labelKey);
  const body = fields
    .map((field) => {
      const value =
        section.kind === "multi"
          ? section.value[field.id]
          : section.kind === "named-lines"
            ? statistics[field.id.split(".").at(-1)]
            : section.value;
      const paragraph = field.paragraph || section.kind === "multiline";
      const label = fieldLabel(field.labelKey);
      if (!enabled) {
        const hideLabel = fields.length === 1 && label === title;
        return `<div class="sheet-field${paragraph ? " wide" : ""}"><dt${hideLabel ? ' class="sr-only"' : ""}>${esc(label)}</dt><dd>${sheetValue(field, section, data, value)}</dd></div>`;
      }
      const hint = field.pair ? t("currentMax") : field.format ? t(field.format) : "";
      return `<label class="sheet-field${paragraph ? " wide" : ""}">${esc(label)}${hint ? ` <small>(${esc(hint)})</small>` : ""}${paragraph ? `<textarea data-field="${attr(field.id)}">${esc(value)}</textarea>` : `<input data-field="${attr(field.id)}" value="${attr(value)}" ${field.numeric ? 'inputmode="decimal"' : ""}>`}</label>`;
    })
    .join("");
  const wrapper = enabled ? "div" : "dl";
  return `<details class="sheet-section section-${attr(section.id)}" open>
    <summary>${esc(title)}</summary>
    <${wrapper} class="section-body" data-section="${attr(section.id)}" data-kind="${attr(section.kind)}">${body}</${wrapper}></details>`;
}
function sheetContents(entity, enabled = false) {
  const sections = [
    ...entity.sections.filter((s) => s.id === "statistics"),
    ...entity.sections.filter((s) => s.id !== "statistics"),
  ];
  return `<div class="sheet-sections">${sections.map((section) => sectionMarkup(section, entity.data, enabled)).join("")}</div>`;
}
async function entityScreen(entityId, campaignId = "") {
  const entity = await api(
    `/api/entities/${encodeURIComponent(entityId)}${campaignId ? `?campaign=${encodeURIComponent(campaignId)}` : ""}`,
  );
  state.sheet = entity;
  state.screen = entity.type === "creature" ? "creatures" : "characters";
  mast();
  state.sheetCampaign = campaignId;
  state.editing = false;
  state.preview = false;
  let campaigns = [];
  if (entity.isOwner) campaigns = (await api("/api/campaigns")).campaigns;
  state.availableCampaigns = campaigns;
  renderSheet();
}
function sheetIdentity(entity) {
  const archetype = entity.type === "character" && entity.data.background?.archetype;
  return `<div class="eyebrow">${esc(t(entity.type === "character" ? "characterSheet" : "creatureSheet"))}</div>
    <h1>${esc(entity.name)}</h1>
    <div class="sheet-meta"><strong>${esc(t("level"))} ${esc(entity.data.level)}</strong>
    ${archetype ? `<span><span class="sr-only">${esc(fieldLabel("character.fields.backgroundArchetype"))}: </span>${esc(archetype)}</span>` : ""}
    <span>${esc(t("owner"))} · ${esc(entity.owner)}</span></div>`;
}
function combatMenus() {
  const resource = (key) => esc(fieldLabel(`character.resources.${key}.abbreviation`));
  return `<details class="action-menu"><summary>${esc(t("damage"))}</summary>
    <form id="damage-form">${input(t("amount"), "amount", "1", 'type="number" min="1" step="1" required')}
      <label><input type="checkbox" name="piercing"> ${esc(t("piercing"))}</label><button>${esc(t("damage"))}</button></form></details>
    <details class="action-menu"><summary>${esc(t("heal"))}</summary><form id="heal-form">
      <label>${esc(t("healResource"))}<select name="resource"><option value="hp">${resource("hp")}</option>
      <option value="armor">${resource("ar")}</option><option value="both">${resource("hp")} + ${resource("ar")}</option></select></label>
      ${input(t("percentage"), "percentage", "100", 'type="number" min="0" max="100" required')}
      <button>${esc(t("heal"))}</button></form></details>${action(t("endTurn"), "combat", "end-turn")}`;
}
function renderSheet() {
  const e = state.sheet,
    edit = state.editing,
    preview = state.preview;
  const lockText =
    e.lock && !edit
      ? `<span class="warning">${esc(t("lockedBy"))}: ${esc(e.lock.username)}</span>`
      : "";
  const controls = e.canEdit
    ? edit
      ? `${action(t("finishEditing"), "lock-finish", "", "")} ${action(t("undo"), "undo", "undo")} ${preview ? action(t("redo"), "undo", "redo") + action(t("saveReversal"), "undo", "save", "") + action(t("cancelReversal"), "undo", "cancel") : ""}`
      : action(t("startEditing"), "lock-start", "", "")
    : "";
  const library = e.type === "character" ? "characters" : "creatures";
  const back = state.sheetCampaign ? `#/campaign/${attr(state.sheetCampaign)}/${library}` : `#/${library}`;
  const editable = edit && !preview;
  app.innerHTML = `<a class="back-link" href="${back}"><span aria-hidden="true">←</span> ${esc(t(library))}</a>
    <header class="sheet-heading paper${e.portrait ? " has-portrait" : ""}">
      <div class="sheet-identity">${sheetIdentity(e)}</div>
      <img class="sheet-portrait" src="${attr(imageFor(e.type, e.id, e.portrait))}" alt="">
    </header>
    <div class="sheet-bar">${resourcePills(e.data.resources)}
      ${controls || lockText ? `<div class="actions">${controls}${lockText}${editable ? combatMenus() : ""}</div>` : ""}</div>
    ${preview ? `<p class="warning">${esc(t("previewing"))}</p>` : ""}
    <div id="lock-warning" class="warning" hidden></div>
    ${editable ? `<div class="edit-intro"><p>${esc(t("editHint"))}</p>
      <form id="entity-portrait-form"><label>${esc(t("portrait"))}<input type="file" name="image" accept="image/png,image/jpeg,image/webp" required></label>
      <div class="actions"><button>${esc(t("upload"))}</button>${action(t("removeImage"), "entity-portrait-remove")}</div>
      <small>${esc(t("imageHint"))}</small></form></div>` : ""}
    ${sheetContents(e, editable)}${
    e.isOwner
      ? `<section class="sheet-settings"><h2 class="ruled-title">${esc(t("sheetSettings"))}</h2><div class="settings-grid"><section class="panel"><h3>${esc(t("permissions"))}</h3>${e.permissions.length ? e.permissions.map((p) => `<div class="list-row"><span class="grow">${esc(p.username)} · ${esc(t(p.permission))}</span>${action(t("revoke"), "revoke-permission", p.username)}</div>`).join("") : `<p class="muted">${esc(t("private"))}</p>`}<form id="permission-form">${input(t("username"), "username", "", "required")}<label>${esc(t("permissions"))}<select name="permission"><option value="viewer">${esc(t("viewer"))}</option><option value="editor">${esc(t("editor"))}</option></select></label><p><button>${esc(t("grant"))}</button></p></form></section><section class="panel"><h3>${esc(t("assignments"))}</h3>${e.assignments.map((a) => `<div class="list-row"><div class="grow">${esc(a.name)}<br>${tag(t(a.state === "pending" ? "pending" : "active"))} ${tag(t(a.visibility))}</div>${action(t("withdraw"), "entity-assignment-remove", a.campaign_id)}${action(t("changeVisibility"), "entity-assignment-visibility", `${a.campaign_id}|${a.visibility === "shared" ? "private" : "shared"}`)}</div>`).join("")}<form id="assignment-form"><label>${esc(t("requestAssignment"))}<select name="campaignId" required>${state.availableCampaigns
          .filter((c) => !e.assignments.some((a) => a.campaign_id === c.id))
          .map((c) => `<option value="${attr(c.id)}">${esc(c.name)}</option>`)
          .join(
            "",
          )}</select></label><label>${esc(t("status"))}<select name="visibility"><option value="private">${esc(t("private"))}</option><option value="shared">${esc(t("shared"))}</option></select></label><p><button>${esc(t("request"))}</button></p></form></section><section class="panel"><h3>${esc(t("transferOwnership"))}</h3><form id="entity-transfer">${input(t("username"), "username", "", "required")}<p><button>${esc(t("transfer"))}</button></p></form><div class="divider">✦</div><h3 class="danger">${esc(t("deleteEntity"))}</h3><p>${esc(t("confirmEntity"))}</p><form id="entity-delete">${input(t("name"), "confirm", "", "required")}<p><button>${esc(t("deleteEntity"))}</button></p></form></section></div></section>`
      : ""
  }`;
  const assignmentForm = document.querySelector("#assignment-form");
  if (assignmentForm) {
    assignmentForm.elements.campaignId.required = false;
    const label = document.createElement("label");
    label.textContent = t("campaignReference");
    const input = document.createElement("input");
    input.name = "campaignReference";
    label.append(input);
    assignmentForm.insertBefore(label, assignmentForm.querySelector("p"));
  }
}
function loseLock() {
  if (!state.editing) return;
  state.editing = false;
  state.preview = false;
  document
    .querySelectorAll(
      "[data-section] input,[data-section] textarea,#entity-portrait-form input",
    )
    .forEach((el) => {
      el.disabled = true;
    });
  const box = document.querySelector("#lock-warning");
  if (box) {
    box.hidden = false;
    box.textContent = t("lockLost");
  }
  notify(t("lockLost"), true);
}
function sectionValue(container) {
  const fields = [...container.querySelectorAll("[data-field]")];
  if (container.dataset.kind === "multi")
    return Object.fromEntries(fields.map((el) => [el.dataset.field, el.value]));
  if (container.dataset.kind === "named-lines")
    return fields
      .map((el) => `${el.dataset.field.split(".").at(-1)}: ${el.value}`)
      .join("\n");
  return fields[0]?.value || "";
}
function mergeSheet(next) {
  state.sheet = {
    ...state.sheet,
    ...next,
    permissions: next.permissions || state.sheet?.permissions,
    assignments: next.assignments || state.sheet?.assignments,
  };
}
function saveSection(container) {
  if (!state.editing || state.preview || !container.dataset.dirty)
    return Promise.resolve();
  const entityId = state.sheet.id,
    value = sectionValue(container),
    captured = JSON.stringify(value);
  if (container.pendingSave?.captured === captured)
    return container.pendingSave.promise;
  state.saveQueue = state.saveQueue
    .catch(() => {})
    .then(async () => {
      if (!state.editing || state.preview || state.sheet?.id !== entityId)
        throw new Error("LOCK_REQUIRED");
      const result = await api(`/api/entities/${entityId}/edit`, "POST", {
        tab: state.tab,
        field: container.dataset.section,
        value,
        version: state.sheet.version,
        campaignId: state.sheetCampaign || null,
      });
      mergeSheet(result.entity);
      if (JSON.stringify(sectionValue(container)) === captured)
        delete container.dataset.dirty;
      document
        .querySelector(".sheet-bar .resources")
        ?.replaceWith(
          document
            .createRange()
            .createContextualFragment(
              resourcePills(state.sheet.data.resources),
            ),
        );
      const identity = document.querySelector(".sheet-identity");
      if (identity) identity.innerHTML = sheetIdentity(state.sheet);
      notify(t("saved"));
    });
  const pending = state.saveQueue.catch((error) => {
    if (error.message === "LOCK_REQUIRED") loseLock();
    notify(errorMessage(error), true);
    throw error;
  });
  container.pendingSave = { captured, promise: pending };
  pending
    .finally(() => {
      if (container.pendingSave?.promise === pending)
        container.pendingSave = null;
    })
    .catch(() => {});
  return pending;
}
async function flushSheet() {
  for (const section of document.querySelectorAll("[data-section][data-dirty]"))
    await saveSection(section);
  await state.saveQueue;
}
function resultMarkup(result) {
  if (!result) return `<div class="empty">${esc(t("noPreview"))}</div>`;
  const fields = result.displayFields || result.fields;
  return `<article class="paper"><div class="eyebrow">${esc(result.generatorName || t("result"))}</div>${
    fields
      ? Object.entries(fields)
          .map(
            ([key, value]) =>
              `<p><strong>${esc(key.replace(/_/g, " "))}</strong><br>${esc(typeof value === "string" ? value : JSON.stringify(value))}</p>`,
          )
          .join("")
      : `<p>${esc(result.value || result.display || "")}</p>`
  }${result.modifiers?.length ? `<div class="divider">✦</div><h3>${esc(t("modifiers"))}</h3>${result.modifiers.map((m) => `<p>${esc(m.display || m.value || "")}</p>`).join("")}` : ""}</article>`;
}
async function generatorScreen() {
  const gen = state.generation;
  if (!gen.language) gen.language = state.language;
  const root =
    gen.kind === "character"
      ? "background"
      : gen.kind === "creature"
        ? "creature"
        : "";
  const path = gen.kind === "general" ? gen.path : gen.path || root;
  const browsing = await api(
    `/api/generators?language=${gen.language}&path=${encodeURIComponent(path)}`,
  );
  if (gen.kind !== "general" && browsing.fields)
    browsing.fields = browsing.fields.filter(
      (item) => item.segment === "generator",
    );
  const chooser = browsing.roots
    ? `<h3>${esc(t("chooseCategory"))}</h3><div class="list">${browsing.roots.map((item) => `<div class="list-row"><div class="grow"><strong>${esc(item.name)}</strong><p class="muted">${esc(item.description)}</p></div>${action(t("choose"), "gen-path", item.id)}</div>`).join("")}</div>`
    : `<p>${action(t("back"), "gen-up")} &nbsp; ${tag(path)} ${action(t("randomChoice"), "gen-select-random", path)}</p>${browsing.candidates.length ? `<h3>${esc(t("entries"))}</h3><div class="list">${browsing.candidates.map((item) => `<div class="list-row"><span class="grow">${esc(item.label)}</span>${action(t("choose"), "gen-path", item.value)}</div>`).join("")}</div>` : ""}${browsing.fields.length ? `<h3>${esc(t("fields"))}</h3><div class="actions">${browsing.fields.map((item) => action(item.label, "gen-path", item.value)).join("")}</div>` : ""}`;
  const types = `<nav class="tabs">${["general", "character", "creature"].map((k) => `<button type="button" aria-pressed="${gen.kind === k}" class="${gen.kind === k ? "active" : ""}" data-action="gen-kind" data-value="${k}">${esc(t(k === "general" ? "generators" : k === "character" ? "generateCharacter" : "generateCreature"))}</button>`).join("")}</nav>`;
  app.innerHTML = `${header(t("generators"), t("generationIntro"))}${types}<div class="split generator-layout"><section class="paper"><label>${esc(t("generationLanguage"))}${langSelect("generationLanguage", gen.language)}</label>${gen.kind !== "general" ? `<label>${esc(t("level"))}<select id="generation-level"><option value="">${esc(t("random"))}</option>${Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}" ${String(gen.level || "") === String(i + 1) ? "selected" : ""}>${i + 1}</option>`).join("")}</select></label><div class="divider">✦</div><h3>${esc(t("generationPath"))}</h3>` : ""}${chooser}<div class="divider">✦</div>${action(gen.preview || gen.result ? t("regenerate") : t("generate"), "generate-now", "", "")}</section><section><h2>${esc(gen.kind === "general" ? t("result") : t("generatedPreview"))}</h2>${gen.kind === "general" ? resultMarkup(gen.result) : gen.preview ? `<div class="paper"><div class="actions">${action(t("saveToLibrary"), "save-generated", "", "")}</div>${gen.kind === "character" && gen.preview.data.background?.archetype ? `<p><strong>${esc(fieldLabel("character.fields.backgroundArchetype"))}:</strong> ${esc(gen.preview.data.background.archetype)}</p>` : ""}${sheetContents(gen.preview)}</div>` : `<div class="empty">${esc(t("noPreview"))}</div>`}</section></div>`;
}
function diceScreen() {
  app.innerHTML = `${header(t("dice"), t("diceIntro"))}<div class="grid two"><section class="paper"><img class="card-art" src="/media/dice-card.webp" alt=""><form id="dice-form">${input(t("expression"), "expression", "1d20", "required")}<small>${esc(t("diceExample"))}</small><p><button>${esc(t("roll"))}</button></p></form></section><section class="paper"><h2>${esc(t("personalRoll"))}</h2><div id="dice-result"><p class="muted">${esc(t("noPreview"))}</p></div></section></div>`;
}
function rulebookScreen() {
  const language = state.rulebookLanguage || state.language;
  app.innerHTML = `${header(t("rulebook"), t("rulebookIntro"), `<a class="button secondary" href="/rulebook/${language}" target="_blank" rel="noopener">${esc(t("openEdition"))}</a>`)}<div class="tabs">${["en", "fr"].map((x) => `<button type="button" aria-pressed="${x === language}" class="${x === language ? "active" : ""}" data-action="rulebook-language" data-value="${x}">${x === "fr" ? "Français" : "English"}</button>`).join("")}</div><iframe class="rulebook-frame" title="${attr(t("rulebook"))}" src="/rulebook/${language}"></iframe>`;
}
async function adminScreen() {
  const [{ users }, { invitations }] = await Promise.all([
    api("/api/admin/users"),
    api("/api/admin/invitations"),
  ]);
  app.innerHTML = `${header(t("administration"))}<div class="split"><section class="paper"><h2>${esc(t("accounts"))}</h2><div class="list">${users.map((u) => `<div class="list-row"><div class="grow"><strong>${esc(u.username)}</strong><p>${tag(t(u.status))} ${tag(t(u.role))}</p></div><div class="actions">${u.status === "pending" ? action(t("approve"), "admin-user", `${u.id}|status|active`) + action(t("reject"), "admin-user", `${u.id}|status|rejected`) : action(t(u.status === "active" ? "disable" : "enable"), "admin-user", `${u.id}|status|${u.status === "active" ? "disabled" : "active"}`)}${u.status === "active" ? action(t(u.role === "admin" ? "makeUser" : "makeAdmin"), "admin-user", `${u.id}|role|${u.role === "admin" ? "user" : "admin"}`) + action(t("resetLink"), "admin-reset", u.username) : ""}</div></div>`).join("")}</div></section><aside class="paper"><h2>${esc(t("inviteLinks"))}</h2>${action(t("createInvite"), "admin-invite", "", "")}<div id="created-link"></div><div class="divider">✦</div>${invitations.length ? invitations.map((i) => `<div class="list-row"><span class="grow">${esc(t("expires"))}: ${esc(new Date(i.expires_at).toLocaleDateString(state.language))}</span>${action(t("revoke"), "admin-invite-remove", i.token_hash)}</div>`).join("") : `<p class="muted">${esc(t("noInvitations"))}</p>`}</aside></div>`;
}
function parseRoute() {
  const [path, query = ""] = (
    location.hash.replace(/^#\/?/, "") || "home"
  ).split("?");
  return {
    parts: path.split("/").filter(Boolean),
    query: new URLSearchParams(query),
  };
}
let renderSequence = 0;
async function renderRoute() {
  const sequence = ++renderSequence;
  const { parts, query } = parseRoute();
  if (!state.user) {
    authScreen();
    return;
  }
  const page = parts[0] || "home",
    newSheet = page === "sheet" ? parts[1] : null;
  const campaignId =
    page === "campaign"
      ? parts[1]
      : page === "sheet"
        ? query.get("campaign")
        : null;
  if (
    state.sheet &&
    state.editing &&
    (newSheet !== state.sheet.id || campaignId !== state.sheetCampaign)
  ) {
    const previous = state.sheet.id;
    await state.saveQueue.catch(() => {});
    await api(`/api/entities/${previous}/lock`, "POST", {
      action: "finish",
      tab: state.tab,
    }).catch(() => {});
    state.editing = false;
    state.preview = false;
    state.sheet = null;
  }
  if (sequence !== renderSequence) return;
  state.screen =
    page === "campaign"
      ? "campaigns"
      : page === "sheet"
        ? state.sheet?.type === "creature"
          ? "creatures"
          : "characters"
        : page;
  mast();
  connect(campaignId || null);
  try {
    if (page === "home") homeScreen();
    else if (page === "campaigns") await campaignList();
    else if (page === "campaign" && parts[1])
      await campaignScreen(
        parts[1],
        ["overview", "members", "characters", "creatures", "settings"].includes(
          parts[2],
        )
          ? parts[2]
          : "overview",
      );
    else if (page === "characters" || page === "creatures")
      await libraryScreen(page === "characters" ? "character" : "creature");
    else if (page === "sheet" && parts[1]) {
      if (newSheet === state.sheet?.id && state.editing) renderSheet();
      else await entityScreen(parts[1], campaignId || "");
    } else if (page === "generators") {
      const kind = query.get("kind");
      if (
        kind &&
        kind !== state.generation.kind &&
        ["character", "creature"].includes(kind)
      )
        state.generation = {
          kind,
          path: "",
          language: state.language,
          preview: null,
          result: null,
        };
      const sourceCampaign = query.get("campaign") || null;
      if (state.generation.campaign !== sourceCampaign) {
        const source = sourceCampaign
          ? await api(`/api/campaigns/${encodeURIComponent(sourceCampaign)}`)
          : null;
        state.generation.campaign = sourceCampaign;
        state.generation.language = source?.campaign.language || state.language;
        state.generation.path = "";
      }
      await generatorScreen();
    } else if (page === "dice") diceScreen();
    else if (page === "rulebook") rulebookScreen();
    else if (page === "admin" && state.user.role === "admin")
      await adminScreen();
    else {
      location.hash = "#/home";
      return;
    }
    if (sequence === renderSequence) app.focus({ preventScroll: true });
  } catch (error) {
    notify(errorMessage(error), true);
    if (error.message === "LOGIN_REQUIRED") {
      state.user = null;
      authScreen();
    } else if (page === "sheet" || page === "campaign") {
      location.hash = "#/home";
    }
  }
}
let refreshTimer;
function refreshSoon() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    if (
      document.activeElement?.matches("input,textarea,select") ||
      state.editing
    ) {
      refreshSoon();
      return;
    }
    renderRoute();
  }, 500);
}
function connect(campaignId) {
  if (state.stream && state.streamCampaign === campaignId) return;
  if (state.stream) {
    state.stream.close();
    state.stream = null;
  }
  state.streamCampaign = campaignId;
  const query = new URLSearchParams({ tab: state.tab });
  if (campaignId) query.set("campaign", campaignId);
  const stream = new EventSource(`/api/events?${query}`);
  state.stream = stream;
  stream.addEventListener("chat", (event) => {
    const box = document.querySelector("#chat");
    if (box) {
      box.insertAdjacentHTML("beforeend", chatMessage(JSON.parse(event.data)));
      box.scrollTop = box.scrollHeight;
    }
  });
  stream.addEventListener("presence", (event) => {
    if (state.campaign) {
      state.campaign.presence = JSON.parse(event.data);
      if (
        state.screen === "campaigns" &&
        !document.activeElement?.matches("input,textarea,select")
      )
        refreshSoon();
    }
  });
  stream.addEventListener("campaign", async () => {
    if (
      state.sheet &&
      state.sheetCampaign === campaignId &&
      parseRoute().parts[0] === "sheet"
    ) {
      if (state.editing) {
        try {
          await api(
            `/api/entities/${encodeURIComponent(state.sheet.id)}?campaign=${encodeURIComponent(campaignId)}`,
          );
        } catch {
          loseLock();
        }
      } else refreshSoon();
    } else if (state.screen === "campaigns") refreshSoon();
  });
  stream.addEventListener("refresh", () => refreshSoon());
  stream.addEventListener("entity", async (event) => {
    const item = JSON.parse(event.data);
    if (state.sheet?.id === item.id && parseRoute().parts[0] === "sheet") {
      if (state.editing) {
        try {
          const sheet = await api(
            `/api/entities/${encodeURIComponent(item.id)}`,
          );
          if (!sheet.lock || sheet.lock.userId !== state.user.id) loseLock();
        } catch {
          loseLock();
        }
      } else refreshSoon();
    } else if (
      state.screen === "campaigns" ||
      state.screen === "characters" ||
      state.screen === "creatures"
    )
      refreshSoon();
  });
  stream.onerror = () => {
    if (state.stream === stream && state.editing) loseLock();
  };
}
async function readImage(file) {
  if (
    !file ||
    file.size > 4 * 1024 * 1024 ||
    !["image/png", "image/jpeg", "image/webp"].includes(file.type)
  )
    throw new Error("INVALID_IMAGE");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("INVALID_IMAGE"));
    reader.readAsDataURL(file);
  });
}
function showLink(path) {
  const node = document.querySelector("#created-link");
  if (node)
    node.innerHTML = `<label>${esc(t("createdLink"))}<input readonly value="${attr(location.origin + path)}"></label>`;
  else window.prompt(t("createdLink"), location.origin + path);
}
async function refreshSheet() {
  const entity = await api(
    `/api/entities/${state.sheet.id}${state.sheetCampaign ? `?campaign=${encodeURIComponent(state.sheetCampaign)}` : ""}`,
  );
  mergeSheet(entity);
  if (entity.isOwner)
    state.availableCampaigns = (await api("/api/campaigns")).campaigns;
  renderSheet();
}
async function refreshSession() {
  const current = await api("/api/me");
  state.user = current.user;
  state.csrf = current.csrf;
  if (state.user) {
    state.language = state.user.language;
    state.locale = await api("/api/locale");
  }
}
document.addEventListener("submit", async (event) => {
  const form = event.target;
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  try {
    if (form.id === "auth-form") {
      const mode = form.dataset.mode,
        params = new URLSearchParams(location.search);
      if (mode === "login") {
        const result = await api("/api/login", "POST", data);
        state.user = result.user;
        state.csrf = result.csrf;
        state.language = result.user.language;
        state.locale = await api("/api/locale");
        history.replaceState(null, "", location.pathname + "#/home");
        await renderRoute();
      } else if (mode === "register") {
        data.invite = params.get("invite") || undefined;
        const result = await api("/api/register", "POST", data);
        history.replaceState(null, "", location.pathname);
        authScreen(
          "login",
          t(result.status === "active" ? "accountActive" : "accountPending"),
        );
      } else {
        await api("/api/reset", "POST", {
          token: params.get("reset"),
          password: data.password,
        });
        history.replaceState(null, "", location.pathname);
        authScreen("login", t("resetDone"));
      }
    } else if (form.id === "create-campaign") {
      const result = await api("/api/campaigns", "POST", data);
      location.hash = `#/campaign/${result.id}/overview`;
    } else if (form.id === "campaign-invite-form") {
      await api(
        `/api/campaigns/${state.campaign.campaign.id}/invite`,
        "POST",
        data,
      );
      form.reset();
      notify(t("requestSent"));
    } else if (form.id === "campaign-settings") {
      await api(`/api/campaigns/${state.campaign.campaign.id}`, "POST", data);
      notify(t("saved"));
      await renderRoute();
    } else if (form.id === "campaign-transfer") {
      await api(
        `/api/campaigns/${state.campaign.campaign.id}/transfer`,
        "POST",
        data,
      );
      notify(t("saved"));
      await renderRoute();
    } else if (form.id === "campaign-delete") {
      await api(`/api/campaigns/${state.campaign.campaign.id}`, "DELETE", data);
      location.hash = "#/campaigns";
    } else if (form.id === "campaign-cover-form") {
      const image = await readImage(form.elements.image.files[0]);
      await api(`/api/campaigns/${state.campaign.campaign.id}/cover`, "POST", {
        image,
      });
      notify(t("saved"));
      await renderRoute();
    } else if (form.id === "chat-form") {
      await api(
        `/api/campaigns/${state.campaign.campaign.id}/chat`,
        "POST",
        data,
      );
      form.reset();
    } else if (form.id === "dice-form") {
      const campaignId =
        parseRoute().parts[0] === "campaign"
          ? state.campaign.campaign.id
          : null;
      const result = await api("/api/dice", "POST", {
        expression: data.expression,
        campaignId,
        private: Boolean(form.elements.private?.checked),
      });
      const target = document.querySelector("#dice-result");
      if (target) target.innerHTML = diceDisplay(result.result);
    } else if (form.id === "damage-form" || form.id === "heal-form") {
      await flushSheet();
      const actionName = form.id === "damage-form" ? "damage" : "heal";
      const result = await api(
        `/api/entities/${state.sheet.id}/combat`,
        "POST",
        {
          ...data,
          tab: state.tab,
          version: state.sheet.version,
          campaignId: state.sheetCampaign || null,
          action: actionName,
          piercing: Boolean(form.elements.piercing?.checked),
        },
      );
      mergeSheet(result.entity);
      renderSheet();
    } else if (form.id === "permission-form") {
      if (state.editing) await flushSheet();
      await api(`/api/entities/${state.sheet.id}/permissions`, "POST", data);
      notify(t("saved"));
      await refreshSheet();
    } else if (form.id === "assignment-form") {
      if (state.editing) await flushSheet();
      const reference = (data.campaignReference || "").trim();
      if (reference)
        data.campaignId =
          reference.match(/#\/campaign\/([a-f0-9-]{36})/i)?.[1] || reference;
      delete data.campaignReference;
      await api(`/api/entities/${state.sheet.id}/assignments`, "POST", data);
      notify(t("requestSent"));
      await refreshSheet();
    } else if (form.id === "entity-transfer") {
      if (state.editing) {
        if (state.preview) throw new Error("UNDO_PREVIEW_ACTIVE");
        await flushSheet();
        await api(`/api/entities/${state.sheet.id}/lock`, "POST", {
          action: "finish",
          tab: state.tab,
        });
        state.editing = false;
      }
      const entityId = state.sheet.id;
      await api(`/api/entities/${entityId}/transfer`, "POST", data);
      notify(t("saved"));
      location.hash = `#/${state.sheet.type === "character" ? "characters" : "creatures"}`;
    } else if (form.id === "entity-delete") {
      const type = state.sheet.type;
      await api(`/api/entities/${state.sheet.id}`, "DELETE", {
        ...data,
        tab: state.tab,
      });
      state.editing = false;
      state.sheet = null;
      notify(t("entityDeleted"));
      location.hash = `#/${type === "character" ? "characters" : "creatures"}`;
    } else if (form.id === "entity-portrait-form") {
      await flushSheet();
      const image = await readImage(form.elements.image.files[0]);
      const result = await api(
        `/api/entities/${state.sheet.id}/portrait`,
        "POST",
        { image, tab: state.tab, version: state.sheet.version },
      );
      mergeSheet(result.entity);
      renderSheet();
    }
  } catch (error) {
    if (error.message === "LOCK_REQUIRED") loseLock();
    notify(errorMessage(error), true);
  }
});
document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const what = button.dataset.action,
    value = button.dataset.value || "";
  try {
    if (what === "auth-mode") authScreen(value);
    else if (what === "logout") {
      await api("/api/logout", "POST");
      state.stream?.close();
      state.stream = null;
      state.streamCampaign = undefined;
      state.user = null;
      state.csrf = null;
      state.editing = false;
      state.sheet = null;
      history.replaceState(null, "", location.pathname);
      authScreen();
    } else if (what === "show-new-campaign")
      document.querySelector("#new-campaign").hidden = false;
    else if (what === "campaign-invite") {
      const [campaign, decision] = value.split("|");
      await api(`/api/campaign-invitations/${campaign}`, "POST", {
        action: decision,
      });
      await campaignList();
    } else if (what === "member-role") {
      const [person, decision] = value.split("|");
      await api(
        `/api/campaigns/${state.campaign.campaign.id}/members/${person}`,
        "POST",
        { action: decision },
      );
      if (person === state.user.id && decision === "remove")
        location.hash = "#/campaigns";
      else await renderRoute();
    } else if (what === "assignment-action") {
      const [entityId, decision] = value.split("|");
      await api(
        `/api/campaigns/${state.campaign.campaign.id}/assignments/${entityId}`,
        "POST",
        { action: decision },
      );
      await renderRoute();
    } else if (what === "campaign-cover-remove") {
      await api(`/api/campaigns/${state.campaign.campaign.id}/cover`, "POST", {
        image: null,
      });
      await renderRoute();
    } else if (what === "new-entity") {
      const result = await api("/api/entities", "POST", { type: value });
      location.hash = `#/sheet/${result.id}`;
    } else if (what === "lock-start") {
      await api(`/api/entities/${state.sheet.id}/lock`, "POST", {
        action: "start",
        tab: state.tab,
      });
      state.editing = true;
      state.preview = false;
      await refreshSheet();
    } else if (what === "lock-finish") {
      if (state.preview) throw new Error("UNDO_PREVIEW_ACTIVE");
      await flushSheet();
      await api(`/api/entities/${state.sheet.id}/lock`, "POST", {
        action: "finish",
        tab: state.tab,
      });
      state.editing = false;
      state.preview = false;
      await refreshSheet();
    } else if (what === "undo") {
      if (!state.preview) await flushSheet();
      const result = await api(`/api/entities/${state.sheet.id}/undo`, "POST", {
        action: value,
        tab: state.tab,
      });
      mergeSheet(result.entity);
      state.preview = result.preview;
      renderSheet();
    } else if (what === "combat") {
      await flushSheet();
      const result = await api(
        `/api/entities/${state.sheet.id}/combat`,
        "POST",
        {
          action: value,
          tab: state.tab,
          version: state.sheet.version,
          campaignId: state.sheetCampaign || null,
        },
      );
      mergeSheet(result.entity);
      renderSheet();
    } else if (what === "entity-portrait-remove") {
      await flushSheet();
      const result = await api(
        `/api/entities/${state.sheet.id}/portrait`,
        "POST",
        { image: null, tab: state.tab, version: state.sheet.version },
      );
      mergeSheet(result.entity);
      renderSheet();
    } else if (what === "revoke-permission") {
      if (state.editing) await flushSheet();
      await api(`/api/entities/${state.sheet.id}/permissions`, "POST", {
        username: value,
        permission: null,
      });
      await refreshSheet();
    } else if (
      what === "entity-assignment-remove" ||
      what === "entity-assignment-visibility"
    ) {
      if (state.editing) await flushSheet();
      const [campaign, visibility] = value.split("|");
      await api(
        `/api/campaigns/${campaign}/assignments/${state.sheet.id}`,
        "POST",
        what.endsWith("remove")
          ? { action: "remove" }
          : { action: "visibility", visibility },
      );
      await refreshSheet();
    } else if (what === "gen-kind") {
      state.generation = {
        kind: value,
        path: "",
        language: state.generation.language || state.language,
        preview: null,
        result: null,
        campaign: state.generation.campaign,
      };
      await generatorScreen();
    } else if (what === "gen-path") {
      state.generation.path = value;
      state.generation.preview = null;
      state.generation.result = null;
      await generatorScreen();
    } else if (what === "gen-up") {
      const gen = state.generation,
        root =
          gen.kind === "character"
            ? "background"
            : gen.kind === "creature"
              ? "creature"
              : "";
      const current = gen.path || root;
      const cut = Math.max(current.lastIndexOf(":"), current.lastIndexOf("."));
      gen.path = cut >= 0 ? current.slice(0, cut) : "";
      if (root && !gen.path) gen.path = root;
      gen.preview = null;
      gen.result = null;
      await generatorScreen();
    } else if (what === "generate-now" || what === "gen-select-random") {
      const gen = state.generation;
      if (gen.kind === "general") {
        if (!gen.path) throw new Error("INVALID_GENERATOR_PATH");
        gen.result = (
          await api("/api/generators", "POST", {
            path: gen.path,
            language: gen.language,
          })
        ).result;
      } else {
        const root = gen.kind === "character" ? "background" : "creature";
        const full = gen.path || root;
        const path = full === root ? "" : full.slice(root.length + 1);
        gen.preview = await api("/api/entity-previews", "POST", {
          type: gen.kind,
          language: gen.language,
          level: gen.level || "",
          path,
        });
      }
      await generatorScreen();
    } else if (what === "save-generated") {
      const result = await api(
        `/api/entity-previews/${state.generation.preview.previewId}/save`,
        "POST",
      );
      state.generation.preview = null;
      location.hash = `#/sheet/${result.id}`;
    } else if (what === "rulebook-language") {
      state.rulebookLanguage = value;
      rulebookScreen();
    } else if (what === "admin-user") {
      const [userId, key, next] = value.split("|");
      await api(`/api/admin/users/${userId}`, "POST", { [key]: next });
      await adminScreen();
    } else if (what === "admin-invite") {
      const result = await api("/api/admin/invitations", "POST");
      await adminScreen();
      showLink(result.path);
    } else if (what === "admin-invite-remove") {
      await api(`/api/admin/invitations/${value}`, "DELETE");
      await adminScreen();
    } else if (what === "admin-reset") {
      const result = await api("/api/admin/reset", "POST", { username: value });
      showLink(result.path);
    }
  } catch (error) {
    if (error.message === "LOCK_REQUIRED") loseLock();
    notify(errorMessage(error), true);
  }
});
document.addEventListener("change", async (event) => {
  const target = event.target;
  try {
    if (target.name === "siteLanguage") {
      if (state.editing && !state.preview) await flushSheet();
      state.language = target.value;
      localStorage.setItem("random-language", state.language);
      if (state.user) {
        await api("/api/language", "POST", { language: state.language });
        state.locale = await api("/api/locale");
        await renderRoute();
      } else authScreen();
    } else if (target.name === "generationLanguage") {
      state.generation.language = target.value;
      state.generation.path = "";
      state.generation.result = null;
      state.generation.preview = null;
      await generatorScreen();
    } else if (target.id === "generation-level")
      state.generation.level = target.value;
    else if (target.dataset.playing) {
      await api(
        `/api/campaigns/${state.campaign.campaign.id}/playing/${target.dataset.playing}`,
        "POST",
        { entityId: target.value || null },
      );
      await renderRoute();
    }
  } catch (error) {
    if (target.dataset.playing)
      target.value =
        state.campaign?.members.find(
          (member) => member.id === target.dataset.playing,
        )?.playing?.id || "";
    notify(errorMessage(error), true);
  }
});
document.addEventListener("input", (event) => {
  const section = event.target.closest("[data-section]");
  if (section && state.editing && !state.preview) section.dataset.dirty = "1";
});
document.addEventListener("focusout", (event) => {
  const section = event.target.closest("[data-section]");
  if (section && state.editing && !state.preview)
    saveSection(section).catch(() => {});
});
let lastActivity = 0;
function editingActivity() {
  if (!state.editing || !state.sheet || Date.now() - lastActivity < 30000)
    return;
  lastActivity = Date.now();
  api(`/api/entities/${state.sheet.id}/lock`, "POST", {
    action: "activity",
    tab: state.tab,
  }).catch(loseLock);
}
document.addEventListener("keydown", editingActivity);
document.addEventListener("pointerdown", editingActivity);
window.addEventListener("hashchange", () => renderRoute());
window.addEventListener("pagehide", () => {
  state.editing = false;
});
refreshSession()
  .then(() => (state.user ? renderRoute() : authScreen()))
  .catch((error) => {
    notify(errorMessage(error), true);
    authScreen();
  });
