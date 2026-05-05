(function () {
	"use strict";

	// Click behavior
	document.querySelectorAll('.todo-item input').forEach(function (input) {
		input.addEventListener('click', function () {
			this.parentElement.parentElement.classList.toggle('todo-strike');
		});
	});

	document.querySelectorAll('.todo-inbox-check input').forEach(function (input) {
		input.addEventListener('click', function () {
			this.parentElement.parentElement.classList.toggle('todo-strike-content');
		});
	});

	document.querySelectorAll('.todo-list input').forEach(function (input) {
		input.addEventListener('click', function () {
			this.parentElement.parentElement.classList.toggle('todo-strike-content');
		});
	});

	// Apply strike for default checked inputs
	document.querySelectorAll('.todo-item input:checked').forEach(function (input) {
		input.parentElement.parentElement.classList.add('todo-strike');
	});

	document.querySelectorAll('.todo-inbox-check input:checked').forEach(function (input) {
		input.parentElement.parentElement.classList.add('todo-strike-content');
	});

	document.querySelectorAll('.todo-list input:checked').forEach(function (input) {
		input.parentElement.parentElement.classList.add('todo-strike-content');
	});

})();
