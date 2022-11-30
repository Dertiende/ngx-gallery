import {
  Component,
  Input,
  Output,
  HostBinding,
  AfterViewInit,
  AfterViewChecked,
  OnDestroy,
  OnChanges,
  ViewChild,
  SimpleChanges,
  NgZone,
  ElementRef,
  EventEmitter,
  ChangeDetectorRef,
  ChangeDetectionStrategy
} from '@angular/core';
import { Platform } from '@angular/cdk/platform';
import { Subscription } from 'rxjs';
import { debounceTime, tap } from 'rxjs/operators';
import { GalleryConfig } from '../models/config.model';
import { GalleryState, GalleryError } from '../models/gallery.model';
import { ThumbnailsPosition, ThumbnailsView } from '../models/constants';
import { ThumbSliderAdapter, HorizontalThumbAdapter, VerticalThumbAdapter } from './adapters';
import { SmoothScrollManager } from '../smooth-scroll';
import { resizeObservable } from '../utils/resize-observer';

declare const Hammer: any;

@Component({
  selector: 'gallery-thumbs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="g-thumbs-container">
      <div #slider
           class="g-slider"
           [attr.centralised]="config.thumbView === thumbnailsView.Contain || adapter.isContentLessThanContainer">
        <gallery-thumb *ngFor="let item of state.items; trackBy: trackByFn; index as i"
                       [style.flex]="'0 0 ' + adapter.thumbSize + 'px'"
                       [type]="item.type"
                       [config]="config"
                       [data]="item.data"
                       [currIndex]="state.currIndex"
                       [index]="i"
                       (click)="config.disableThumb ? null : thumbClick.emit(i)"
                       (error)="error.emit({itemIndex: i, error: $event})">
        </gallery-thumb>
      </div>
    </div>
  `
})
export class GalleryThumbsComponent implements AfterViewInit, AfterViewChecked, OnChanges, OnDestroy {

  /** HammerJS instance */
  private _hammer: any;

  /** Thumbnails view enum */
  readonly thumbnailsView = ThumbnailsView;

  /** Subscription reference to host resize stream */
  private _resizeObserver$: Subscription;

  /** Slider adapter */
  adapter: ThumbSliderAdapter;

  /** Gallery state */
  @Input() state: GalleryState;

  /** Gallery config */
  @Input() config: GalleryConfig;

  /** Stream that emits when thumb is clicked */
  @Output() thumbClick = new EventEmitter<number>();

  /** Stream that emits when an error occurs */
  @Output() error = new EventEmitter<GalleryError>();

  /** Host height */
  @HostBinding('style.height') height: string;

  /** Host width */
  @HostBinding('style.width') width: string;

  /** Slider ElementRef */
  @ViewChild('slider', { static: true }) sliderEl: ElementRef;

  get slider(): HTMLElement {
    return this.sliderEl.nativeElement;
  }

  get centralizerSize(): number {
    if (this.adapter.isContentLessThanContainer) {
      const size = this.adapter.clientSize - (this.adapter.thumbSize * this.state.items.length);
      return size / 2;
    }
    return (this.adapter.clientSize / 2) - (this.adapter.thumbSize / 2);
  }

  constructor(private _el: ElementRef,
              private _zone: NgZone,
              private _smoothScroll: SmoothScrollManager,
              private _cd: ChangeDetectorRef,
              private _platform: Platform) {
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.config) {
      // Sets sliding direction
      if (changes.config.currentValue?.thumbPosition !== changes.config.previousValue?.thumbPosition) {
        switch (this.config.thumbPosition) {
          case ThumbnailsPosition.Right:
          case ThumbnailsPosition.Left:
            this.adapter = new VerticalThumbAdapter(this.slider, this.config);
            break;
          case ThumbnailsPosition.Top:
          case ThumbnailsPosition.Bottom:
            this.adapter = new HorizontalThumbAdapter(this.slider, this.config);
            break;
        }
        // Set host height and width according to thumb position
        this.width = this.adapter.containerWidth;
        this.height = this.adapter.containerHeight;

        if (this.config.contentVisibilityAuto) {
          this.slider.style.setProperty('--thumb-contain-intrinsic-size', `${ this.config.thumbWidth }px ${ this.config.thumbHeight }px`);
        }

        if (!changes.config.firstChange) {
          // Keep the correct sliding position when direction changes
          requestAnimationFrame(() => {
            this.scrollToIndex(this.state.currIndex, 'auto');
          });
        }

        // Reactivate gestures
        this.enableDisableGestures();
      }

      if (!changes.config.firstChange && changes.config.currentValue?.thumbMouseSlidingDisabled !== changes.config.previousValue?.thumbMouseSlidingDisabled) {
        this.enableDisableGestures();
      }
    }

    if (changes.state && (changes.state.firstChange || !this.config.thumbDetached)) {
      if (changes.state.currentValue?.currIndex !== changes.state.previousValue?.currIndex) {
        // Scroll slide to item when current index changes.
        requestAnimationFrame(() => {
          this.scrollToIndex(this.state.currIndex, changes.state?.firstChange ? 'auto' : 'smooth');
        });
      }
    }
  }

  ngAfterViewInit(): void {
    // Workaround: opening a lightbox (centralised) with last index active, show in wrong position
    setTimeout(() => this.scrollToIndex(this.state.currIndex, 'auto'), 200);

    this._zone.runOutsideAngular(() => {
      // Update necessary calculation on host resize
      if (this._platform.isBrowser) {
        this._resizeObserver$ = resizeObservable(this._el.nativeElement).pipe(
          debounceTime(this.config.resizeDebounceTime),
          tap(() => {
            // Update thumb centralize size
            this.slider.style.setProperty('--thumb-centralize-size', this.centralizerSize + 'px');
            this._cd.detectChanges();
            this.scrollToIndex(this.state.currIndex, 'auto');
          })
        ).subscribe();
      }
    });
  }

  ngAfterViewChecked(): void {
    this.slider.style.setProperty('--thumb-centralize-size', this.centralizerSize + 'px');
  }

  ngOnDestroy(): void {
    this.deactivateGestures();
    this._resizeObserver$?.unsubscribe();
  }

  trackByFn(index: number, item: any) {
    return item.type;
  }

  private scrollToIndex(value: number, behavior): void {
    this._zone.runOutsideAngular(() => {
      // @ts-ignore
      this.slider.style.scrollSnapType = 'unset';
      this._smoothScroll.scrollTo(this.slider, this.adapter.getCentralisedScrollToValue(value, behavior)).then(() => {
        // @ts-ignore
        this.slider.style.scrollSnapType = this.adapter.scrollSnapType;
      });
    });
  }

  private enableDisableGestures(): void {
    if (!this._platform.IOS && !this._platform.ANDROID) {
      // Enable/Disable mouse sliding on desktop browser only
      if (!this.config.thumbMouseSlidingDisabled) {
        this.activateGestures();
      } else {
        this.deactivateGestures();
      }
    }
  }

  private activateGestures(): void {
    if (typeof Hammer !== 'undefined' && !this.config.disableThumb) {

      const direction: number = this.adapter.panDirection;

      // Activate gestures
      this._zone.runOutsideAngular(() => {
        this._hammer = new Hammer(this._el.nativeElement, { inputClass: Hammer.MouseInput });
        this._hammer.get('pan').set({ direction });

        let panOffset: number = 0;

        this._hammer.on('panstart', () => {
          panOffset = this.adapter.scrollValue;
          // Disable scroll-snap-type functionality
          // @ts-ignore
          this.slider.style.scrollSnapType = 'unset';
          this.slider.classList.add('g-sliding');
        });
        this._hammer.on('panmove', (e) => this.slider.scrollTo(this.adapter.getPanValue(panOffset, e, 'auto')));
        this._hammer.on('panend', () => {
          // Enable scroll-snap-type functionality
          // @ts-ignore
          this.slider.style.scrollSnapType = this.adapter.scrollSnapType;
          this.slider.classList.remove('g-sliding');
        });
      });
    }
  }

  private deactivateGestures(): void {
    this._hammer?.destroy();
  }
}
