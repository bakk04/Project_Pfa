/*
Author       : Dreams Technologies
Template Name: Dreams AI
*/

(function () {
	"use strict";

	var MOBILE_BREAKPOINT_PX = 1200;

	var chatWrapper = document.querySelector('.chat-wrapper');
	var chat = chatWrapper ? chatWrapper.querySelector('.chat') : null;
	var sidebarGroup = chatWrapper ? chatWrapper.querySelector('.sidebar-group') : null;

	function isMobileWidth() {
		return window.innerWidth < MOBILE_BREAKPOINT_PX;
	}

	function showMobileSidebar() {
		if (!chat || !sidebarGroup) return;
		document.body.dataset.chatMobileView = 'sidebar';
		chat.classList.add('hide-chatbar');
		chat.classList.remove('show', 'hidden');
		sidebarGroup.classList.remove('hidden');
	}

	function showMobileChat() {
		if (!chat || !sidebarGroup) return;
		document.body.dataset.chatMobileView = 'chat';
		sidebarGroup.classList.add('hidden');
		chat.classList.remove('hide-chatbar', 'hidden');
		chat.classList.add('show');
	}

	function syncChatLayoutToWidth() {
		if (!chat || !sidebarGroup) return;

		if (!isMobileWidth()) {
			sidebarGroup.classList.remove('hidden');
			chat.classList.remove('hide-chatbar', 'hidden');
			chat.classList.add('show');
			return;
		}

		var view = document.body.dataset.chatMobileView;
		if (view === 'chat') {
			showMobileChat();
		} else {
			showMobileSidebar();
		}
	}

	// Top Online Contacts
	document.addEventListener('click', function (e) {
		if (e.target.closest('.chat-close')) {
			e.preventDefault();
			if (isMobileWidth()) {
				showMobileSidebar();
			} else if (chat) {
				chat.classList.remove('show');
			}
		}
	});

	document.addEventListener('click', function (e) {
		if (e.target.closest('.user-item')) {
			if (isMobileWidth()) {
				showMobileChat();
			}
		}
	});

	var resizeTimer;
	window.addEventListener('resize', function () {
		window.clearTimeout(resizeTimer);
		resizeTimer = window.setTimeout(syncChatLayoutToWidth, 100);
	});

	// Ensure initial state on load for <992px
	syncChatLayoutToWidth();

	// Close profile handler 1
	document.querySelectorAll('.close_profile').forEach(function (el) {
		el.addEventListener('click', function () {
			document.querySelectorAll('.right-side-contact').forEach(function (rsc) {
				rsc.classList.add('hide-right-sidebar');
				rsc.classList.remove('show-right-sidebar');
			});
			if (window.innerWidth > 991 && window.innerWidth < 1201) {
				var chatEl = document.querySelector('.chat');
				if (chatEl) chatEl.style.marginLeft = '0';
			}
			if (window.innerWidth < 992) {
				var chatEl = document.querySelector('.chat');
				if (chatEl) chatEl.classList.remove('hide-chatbar');
			}
		});
	});

	// Emoji toggles
	var emojAction = document.querySelector('.emoj-action');
	if (emojAction) {
		emojAction.addEventListener('click', function () {
			var list = document.querySelector('.emoj-group-list');
			if (list) list.style.display = list.style.display === 'none' ? '' : 'none';
		});
	}

	var emojActionFoot = document.querySelector('.emoj-action-foot');
	if (emojActionFoot) {
		emojActionFoot.addEventListener('click', function () {
			var list = document.querySelector('.emoj-group-list-foot');
			if (list) list.style.display = list.style.display === 'none' ? '' : 'none';
		});
	}

	// Chat Resize — Close profile handler 2
	document.querySelectorAll('.close_profile').forEach(function (el) {
		el.addEventListener('click', function () {
			var rightUserSide = document.querySelector('.right-user-side');
			if (rightUserSide) rightUserSide.classList.remove('open-message');
			var cardComman = document.querySelector('.chat-center-blk .card-comman');
			if (cardComman) cardComman.classList.add('chat-center-space');
		});
	});

	document.querySelectorAll('.profile-open').forEach(function (el) {
		el.addEventListener('click', function () {
			var rightUserSide = document.querySelector('.right-user-side');
			if (rightUserSide) rightUserSide.classList.remove('add-setting');
			var cardComman = document.querySelector('.chat-center-blk .card-comman');
			if (cardComman) cardComman.classList.remove('chat-center-space');
		});
	});

	// Call Resize — Close profile handler 3
	document.querySelectorAll('.close_profile').forEach(function (el) {
		el.addEventListener('click', function () {
			var rightUserSide = document.querySelector('.right-user-side');
			if (rightUserSide) rightUserSide.classList.remove('open-message');
			var videoScreen = document.querySelector('.video-screen-inner');
			if (videoScreen) videoScreen.classList.remove('video-space');
			var rightSideParty = document.querySelector('.right-side-party');
			if (rightSideParty) rightSideParty.classList.remove('open-message');
			var meetingList = document.querySelector('.meeting-list');
			if (meetingList) meetingList.classList.remove('add-meeting');
			var chatRoom = document.getElementById('chat-room');
			if (chatRoom) chatRoom.classList.remove('open-chats');
			document.querySelectorAll('.main-img').forEach(function (el) {
				el.classList.remove('main-img-hide');
			});
			document.querySelectorAll('.join-video').forEach(function (el) {
				el.classList.remove('main-img-hide');
			});
			var callUserSide = document.querySelector('.call-user-side');
			if (callUserSide) callUserSide.classList.add('add-setting');
		});
	});

	var showMessageBtn = document.getElementById('show-message');
	if (showMessageBtn) {
		showMessageBtn.addEventListener('click', function () {
			var chatRoom = document.getElementById('chat-room');
			if (chatRoom) chatRoom.classList.add('open-chats');
			var rightSideParty = document.querySelector('.right-side-party');
			if (rightSideParty) rightSideParty.classList.remove('open-message');
			document.querySelectorAll('.main-img').forEach(function (el) {
				el.classList.add('main-img-hide');
			});
			document.querySelectorAll('.join-video').forEach(function (el) {
				el.classList.add('main-img-hide');
			});
		});
	}

	// Chat Search Visible
	document.querySelectorAll('.chat-search-btn').forEach(function (el) {
		el.addEventListener('click', function () {
			var chatSearch = document.querySelector('.chat-search');
			if (chatSearch) chatSearch.classList.add('visible-chat');
		});
	});

	document.querySelectorAll('.close-btn-chat').forEach(function (el) {
		el.addEventListener('click', function () {
			var chatSearch = document.querySelector('.chat-search');
			if (chatSearch) chatSearch.classList.remove('visible-chat');
		});
	});

	// Chat search filter — note: original jQuery used .filter() with side effects, converted to .forEach()
	var searchInput = document.querySelector('.chat-search .form-control');
	if (searchInput) {
		searchInput.addEventListener('keyup', function () {
			var value = this.value.toLowerCase();
			document.querySelectorAll('.chat .chat-body .messages .chats').forEach(function (el) {
				el.style.display = el.textContent.toLowerCase().indexOf(value) > -1 ? '' : 'none';
			});
		});
	}

	// Guest toggle
	document.querySelectorAll('.guest-off').forEach(function (el) {
		el.addEventListener('click', function () {
			this.classList.toggle('activate');
			var activeUsers = document.querySelector('.chat-active-users');
			if (activeUsers) activeUsers.classList.toggle('show-active-users');
		});
	});
})();
