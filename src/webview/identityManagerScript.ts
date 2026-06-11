export const identityManagerScript = String.raw`
(function () {
	const vscode = acquireVsCodeApi();
	function post(command, payload) { vscode.postMessage({ command, payload: payload || {} }); }
	document.addEventListener('click', function (event) {
		const rawTarget = event.target;
		if (!rawTarget || !rawTarget.closest) { return; }
		const target = rawTarget.closest('button[data-command]');
		if (!target || target.disabled || !target.dataset || !target.dataset.command) { return; }
		post(target.dataset.command, Object.assign({}, target.dataset));
	});

	document.addEventListener('input', function (event) {
		const target = event.target;
		if (!target || !target.dataset || !target.dataset.localFilter) { return; }
		const scope = document.querySelector(target.dataset.localFilter);
		if (!scope) { return; }
		const query = String(target.value || '').trim().toLowerCase();
		const items = scope.querySelectorAll('[data-filter-text]');
		items.forEach(function (item) {
			const text = String(item.getAttribute('data-filter-text') || '').toLowerCase();
			item.classList.toggle('hidden-by-filter', !!query && text.indexOf(query) === -1);
		});
	});

	document.addEventListener('change', function (event) {
		const target = event.target;
		if (!target || !target.dataset) { return; }
		if (target.dataset.commandSelect) {
			const command = target.value;
			if (command) { post(command, {}); }
			target.value = '';
			return;
		}
		if (target.dataset.command !== 'updateDraft') { return; }
		post('updateDraft', { id: target.dataset.id, field: target.dataset.field, value: target.value });
	});

	document.addEventListener('focusout', function (event) {
		const target = event.target;
		if (!target || !target.dataset) { return; }
		if (target.dataset.command !== 'updateDraft') { return; }
		if (target.tagName === 'SELECT') { return; }
		post('updateDraft', { id: target.dataset.id, field: target.dataset.field, value: target.value });
	});
}());
`;
