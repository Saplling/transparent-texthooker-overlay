// https://stackoverflow.com/questions/74464771/how-to-implement-click-through-window-except-on-element-in-electron
let isMouseOverInteractiveElement = false;

window.addEventListener('DOMContentLoaded', () => {
    const interactiveElements =
        document.querySelectorAll('.interactive');

    interactiveElements.forEach((element) => {
        element.addEventListener('mouseenter', () => {
            isMouseOverInteractiveElement = true;
            ipcRenderer.send('set-ignore-mouse-events', false);
        });
        if (!element.classList.contains("half-interactive")) {
            element.addEventListener('mouseleave', () => {
                isMouseOverInteractiveElement = false;
                ipcRenderer.send('set-ignore-mouse-events', true, { forward: true });
            });
        }

    });
});