import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UnleashService } from './unleash.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  isReady = false;
  newCheckout = false;
  darkMode = false;
  paymentProvider = '';
  premium = false;
  
  private unsubscribe?: () => void;

  constructor(
    private unleash: UnleashService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    await this.unleash.start();
    this.isReady = true;
    this.evaluateFlags();
    this.cdr.detectChanges();

    // Subscribe to toolbar events
    this.unsubscribe = this.unleash.subscribe((event: any) => {
      if (event.type === 'flag_override_changed' || 
          event.type === 'context_override_changed' ||
          event.type === 'sdk_updated') {
        this.evaluateFlags();
        this.cdr.detectChanges();
      }
    });
  }

  ngOnDestroy() {
    this.unsubscribe?.();
  }

  private evaluateFlags() {
    this.newCheckout = this.unleash.isEnabled('new-checkout');
    this.darkMode = this.unleash.isEnabled('dark-mode');
    const variant = this.unleash.getVariant('payment-provider');
    this.paymentProvider = variant.enabled ? variant.name : 'default';
    this.premium = this.unleash.isEnabled('premium-features');
  }
}
