import {
  Component,
  Input,
  Output,
  HostBinding,
  EventEmitter,
  OnInit,
  ChangeDetectionStrategy
} from '@angular/core';
import { DomSanitizer, SafeHtml, SafeUrl } from '@angular/platform-browser';
import { animate, style, transition, trigger } from '@angular/animations';

@Component({
  selector: 'gallery-image',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('fadeIn', [
      transition('* => success', [
        style({ opacity: 0 }),
        animate('300ms ease-in', style({ opacity: 1 }))
      ])
    ])
  ],
  template: `
    <ng-container [ngSwitch]="state">
      <img [@fadeIn]="state"
           [src]="src"
           [attr.alt]="alt"
           [style.visibility]="state === 'loading' ? 'hidden' : 'unset'"
           class="g-image-item"
           loading="lazy"
           (load)="state = 'success'"
           (error)="state = 'failed'; error.emit($event)"/>

      <div *ngSwitchCase="'failed'"
           class="g-image-error-message">
        <div *ngIf="errorTemplate; else defaultError"
             [innerHTML]="errorTemplate"></div>
        <ng-template #defaultError>
          <ng-container *ngIf="isThumbnail; else isLarge">
            <h4>⚠</h4>
          </ng-container>
          <ng-template #isLarge>
            <h2>⚠</h2>
            <p>Unable to load the image!</p>
          </ng-template>
        </ng-template>
      </div>

      <ng-container *ngSwitchCase="'loading'">
        <div *ngIf="loaderTemplate; else defaultLoader"
             class="g-loading"
             [innerHTML]="loaderTemplate">
        </div>
        <ng-template #defaultLoader>
          <div *ngIf="isThumbnail" class="g-thumb-loading"></div>
        </ng-template>
      </ng-container>
    </ng-container>
  `
})

export class GalleryImageComponent implements OnInit {

  state: 'loading' | 'success' | 'failed' = 'loading';

  /** Progress value */
  progress = 0;

  /** Is thumbnail */
  @Input() isThumbnail: boolean;

  /** Image alt */
  @Input() alt: string;

  /** Image source URL */
  @Input() src: string;
  /** Loaded image URL */
  imageUrl: SafeUrl;

  /** Custom loader template */
  @Input() loadingIcon: string;
  /** Custom loader safe template */
  loaderTemplate: SafeHtml;

  /** Custom error template */
  @Input() loadingError: string;
  /** Custom error safe template */
  errorTemplate: SafeHtml;

  /** Stream that emits when an error occurs */
  @Output() error = new EventEmitter<ErrorEvent>();

  @HostBinding('attr.image-state') get imageState(): string {
    return this.state;
  }

  constructor(private _sanitizer: DomSanitizer) {
  }

  ngOnInit() {
    if (this.loadingIcon) {
      this.loaderTemplate = this._sanitizer.bypassSecurityTrustHtml(this.loadingIcon);
    }
    if (this.loadingError) {
      this.errorTemplate = this._sanitizer.bypassSecurityTrustHtml(this.loadingError);
    }
  }
}
