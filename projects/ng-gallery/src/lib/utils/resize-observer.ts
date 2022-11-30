import { Observable} from 'rxjs';
import ResizeObserver from 'resize-observer-polyfill';

export function resizeObservable(elem: HTMLElement) {
    return new Observable(subscriber => {
        var ro = new ResizeObserver(entries => {
            subscriber.next(entries);
        });
        // Observe one or multiple elements
        ro.observe(elem);
        return function unsubscribe() {
            ro.unobserve(elem);
        }
    });
}
