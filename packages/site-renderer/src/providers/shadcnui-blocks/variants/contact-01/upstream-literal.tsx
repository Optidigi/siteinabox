// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
import { ProviderAction, ProviderContactIcon, ProviderContactLink, ProviderDemoOnly, ProviderField, ProviderImage, ProviderItemField, ProviderItemLink, ProviderItems, ProviderLogo } from "../../runtime/content";
import { MailIcon, MapPinIcon, PhoneIcon } from "lucide-react";
import Link from "../../runtime/link";

const Contact = () => (
  <div className="flex min-h-screen items-center justify-center py-16">
    <div className="text-center">
      <ProviderDemoOnly fallback={<><b className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
        Contact Us
      </b></>} />
      <h2 className="mt-3 font-medium text-4xl tracking-tight"><ProviderField field="title" fallback={<>Get In Touch</>} inline /></h2>
      <p className="mt-3 text-lg text-muted-foreground md:text-xl"><ProviderField field="description" fallback={<>
        Our friendly team is always here to chat
      </>} inline /></p>
      <div className="mx-auto grid max-w-(--breakpoint-xl) gap-16 px-6 py-24 md:grid-cols-2 md:gap-10 md:px-0 lg:grid-cols-3">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/30 bg-primary/5 text-primary shadow-xl/2 dark:bg-primary/10">
            <ProviderContactIcon field="items" index={0} fallback={<MailIcon />} />
          </div>
          <h3 className="mt-6 font-medium text-xl"><ProviderItemField field="items" index={0} subField="title" fallback={<>Email</>} /></h3>
          <p className="mt-2 text-muted-foreground"><ProviderItemField field="items" index={0} subField="description" fallback={<>
            Our friendly team is here to help.
          </>} /></p>
          <ProviderContactLink field="items" index={0} fallback={<>
            akashmoradiya3444@gmail.com
          </>} className="mt-4 font-medium text-primary" />
        </div>
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/30 bg-primary/5 text-primary shadow-xl/2 dark:bg-primary/10">
            <ProviderContactIcon field="items" index={1} fallback={<MapPinIcon />} />
          </div>
          <h3 className="mt-6 font-medium text-xl"><ProviderItemField field="items" index={1} subField="title" fallback={<>Office</>} /></h3>
          <p className="mt-2 text-muted-foreground"><ProviderItemField field="items" index={1} subField="description" fallback={<>
            Come say hello at our office HQ.
          </>} /></p>
          <ProviderContactLink field="items" index={1} fallback={<>
            100 Smith Street Collingwood <br /> VIC 3066 AU
          </>} className="mt-4 font-medium text-primary" target="_blank" />
        </div>
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/30 bg-primary/5 text-primary shadow-xl/2 dark:bg-primary/10">
            <ProviderContactIcon field="items" index={2} fallback={<PhoneIcon />} />
          </div>
          <h3 className="mt-6 font-medium text-xl"><ProviderItemField field="items" index={2} subField="title" fallback={<>Phone</>} /></h3>
          <p className="mt-2 text-muted-foreground"><ProviderItemField field="items" index={2} subField="description" fallback={<>Mon-Fri from 8am to 5pm.</>} /></p>
          <ProviderContactLink field="items" index={2} fallback={<>
            +1 (555) 000-0000
          </>} className="mt-4 font-medium text-primary" />
        </div>
      </div>
    </div>
  </div>
);

export default Contact;
