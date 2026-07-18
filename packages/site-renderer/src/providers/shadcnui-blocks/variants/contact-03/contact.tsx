// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
import { ProviderAction, ProviderContactIcon, ProviderContactLink, ProviderDemoOnly, ProviderField, ProviderImage, ProviderItemField, ProviderItemLink, ProviderItems, ProviderLogo } from "../../runtime/content";
import { MailIcon, MapPinIcon, MessageCircle, PhoneIcon } from "lucide-react";
import Link from "../../runtime/link";

const Contact = () => (
  <div className="flex min-h-screen items-center justify-center pt-12 pb-16 md:pt-16">
    <div className="mx-auto w-full max-w-(--breakpoint-xl) px-6 xl:px-0">
      <ProviderDemoOnly fallback={<><b className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
        Contact Us
      </b></>} />
      <h2 className="mt-3 font-medium text-4xl tracking-[-0.04em]"><ProviderField field="title" fallback={<>
        We&apos;d love to hear from you
      </>} inline /></h2>
      <p className="mt-3 text-lg text-muted-foreground md:text-xl"><ProviderField field="description" fallback={<>
        Our friendly team is always here to chat.
      </>} inline /></p>
      <div className="mt-14 grid gap-8 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <div className="rounded-xl border border-dashed bg-muted/20 p-6 pb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-foreground/5 text-foreground dark:bg-muted">
            <ProviderContactIcon field="items" index={0} fallback={<MailIcon />} />
          </div>
          <h3 className="mt-8 font-medium text-xl"><ProviderItemField field="items" index={0} subField="title" fallback={<>Email</>} /></h3>
          <p className="mt-1.5 mb-4 text-muted-foreground"><ProviderItemField field="items" index={0} subField="description" fallback={<>
            Our friendly team is here to help.
          </>} /></p>
          <ProviderContactLink field="items" index={0} fallback={<>
            akashmoradiya3444@gmail.com
          </>} className="font-medium" />
        </div>
        <div className="rounded-xl border border-dashed bg-muted/20 p-6 pb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-foreground/5 text-foreground dark:bg-muted">
            <MessageCircle />
          </div>
          <h3 className="mt-8 font-medium text-xl"><ProviderItemField field="items" index={1} subField="title" fallback={<>Live chat</>} /></h3>
          <p className="mt-1.5 mb-4 text-muted-foreground"><ProviderItemField field="items" index={1} subField="description" fallback={<>
            Our friendly team is here to help.
          </>} /></p>
          <ProviderContactLink field="items" index={1} fallback={<>
            Start new chat
          </>} className="font-medium" />
        </div>
        <div className="rounded-xl border border-dashed bg-muted/20 p-6 pb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-foreground/5 text-foreground dark:bg-muted">
            <ProviderContactIcon field="items" index={2} fallback={<MapPinIcon />} />
          </div>
          <h3 className="mt-8 font-medium text-xl"><ProviderItemField field="items" index={2} subField="title" fallback={<>Office</>} /></h3>
          <p className="mt-1.5 mb-4 text-muted-foreground"><ProviderItemField field="items" index={2} subField="description" fallback={<>
            Come say hello at our office HQ.
          </>} /></p>
          <ProviderContactLink field="items" index={2} fallback={<>
            100 Smith Street Collingwood <br /> VIC 3066 AU
          </>} className="font-medium" target="_blank" />
        </div>
        <div className="rounded-xl border border-dashed bg-muted/20 p-6 pb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-foreground/5 text-foreground dark:bg-muted">
            <ProviderContactIcon field="items" index={3} fallback={<PhoneIcon />} />
          </div>
          <h3 className="mt-8 font-medium text-xl"><ProviderItemField field="items" index={3} subField="title" fallback={<>Phone</>} /></h3>
          <p className="mt-1.5 mb-4 text-muted-foreground"><ProviderItemField field="items" index={3} subField="description" fallback={<>
            Mon-Fri from 8am to 5pm.
          </>} /></p>
          <ProviderContactLink field="items" index={3} fallback={<>
            +1 (555) 000-0000
          </>} className="font-medium" />
        </div>
      </div>
    </div>
  </div>
);

export default Contact;
