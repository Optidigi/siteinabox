import * as migration_20260505_172626_initial_schema from './20260505_172626_initial_schema';
import * as migration_20260505_194128_users_tenants_array from './20260505_194128_users_tenants_array';
import * as migration_20260505_202447_cascade_tenant_delete from './20260505_202447_cascade_tenant_delete';
import * as migration_20260505_222023_grow_site_settings from './20260505_222023_grow_site_settings';
import * as migration_20260506_205114_block_presets from './20260506_205114_block_presets';
import * as migration_20260509_media_tenant_filename_unique from './20260509_media_tenant_filename_unique';
import * as migration_20260509_pages_tenant_slug_unique from './20260509_pages_tenant_slug_unique';
import * as migration_20260509_site_settings_tenant_unique from './20260509_site_settings_tenant_unique';
import * as migration_20260513_173542_add_tenant_site_manifest from './20260513_173542_add_tenant_site_manifest';
import * as migration_20260513_180426_rt_v2_fields from './20260513_180426_rt_v2_fields';
import * as migration_20260514_001339_add_user_editor_mode from './20260514_001339_add_user_editor_mode';
import * as migration_20260514_155511_add_hero_pills_cta_eyebrow from './20260514_155511_add_hero_pills_cta_eyebrow';
import * as migration_20260514_174118_narrow_editor_mode from './20260514_174118_narrow_editor_mode';
import * as migration_20260514_181246_add_tenant_theme from './20260514_181246_add_tenant_theme';
import * as migration_20260515_134310_round4_theme_roles_dark from './20260515_134310_round4_theme_roles_dark';
import * as migration_20260518_074235_add_block_anchors from './20260518_074235_add_block_anchors';
import * as migration_20260519_220324_nav_restructure from './20260519_220324_nav_restructure';
import * as migration_20260520_061420_drop_rt_field_required from './20260520_061420_drop_rt_field_required';
import * as migration_20260520_170754_add_contact_submit_label from './20260520_170754_add_contact_submit_label';
import * as migration_20260522_083500_media_filename_compound_index from './20260522_083500_media_filename_compound_index';
import * as migration_20260525_205316_add_user_language from './20260525_205316_add_user_language';
import * as migration_20260526_073543_add_site_settings_chrome_maintenance from './20260526_073543_add_site_settings_chrome_maintenance';
import * as migration_20260526_081627_remove_unsupported_site_chrome_fields from './20260526_081627_remove_unsupported_site_chrome_fields';
import * as migration_20260526_100840_add_site_settings_business_ids from './20260526_100840_add_site_settings_business_ids';
import * as migration_20260527_175609_add_site_chrome_logo_overrides from './20260527_175609_add_site_chrome_logo_overrides';
import * as migration_20260527_194417_add_footer_composition_columns from './20260527_194417_add_footer_composition_columns';
import * as migration_20260602_111601_add_cta_background_image from './20260602_111601_add_cta_background_image';
import * as migration_20260602_121112_make_cta_primary_optional from './20260602_121112_make_cta_primary_optional';
import * as migration_20260611_010713_add_better_auth_tables from './20260611_010713_add_better_auth_tables';
import * as migration_20260625_163925_add_intake_generation_runs from './20260625_163925_add_intake_generation_runs';
import * as migration_20260625_190000_add_ai_generation_run_metadata from './20260625_190000_add_ai_generation_run_metadata';
import * as migration_20260625_210000_add_preview_approval_state from './20260625_210000_add_preview_approval_state';
import * as migration_20260625_230000_add_published_site_snapshots from './20260625_230000_add_published_site_snapshots';
import * as migration_20260626_120000_add_preview_access_grants from './20260626_120000_add_preview_access_grants';
import * as migration_20260627_120000_add_concrete_block_model_schema from './20260627_120000_add_concrete_block_model_schema';
import * as migration_20260627_130000_add_marketing_catalog_cms_schema from './20260627_130000_add_marketing_catalog_cms_schema';
import * as migration_20260627_140000_add_tenant_chrome_variant_enum_values from './20260627_140000_add_tenant_chrome_variant_enum_values';

export const migrations = [
  {
    up: migration_20260505_172626_initial_schema.up,
    down: migration_20260505_172626_initial_schema.down,
    name: '20260505_172626_initial_schema',
  },
  {
    up: migration_20260505_194128_users_tenants_array.up,
    down: migration_20260505_194128_users_tenants_array.down,
    name: '20260505_194128_users_tenants_array',
  },
  {
    up: migration_20260505_202447_cascade_tenant_delete.up,
    down: migration_20260505_202447_cascade_tenant_delete.down,
    name: '20260505_202447_cascade_tenant_delete',
  },
  {
    up: migration_20260505_222023_grow_site_settings.up,
    down: migration_20260505_222023_grow_site_settings.down,
    name: '20260505_222023_grow_site_settings',
  },
  {
    up: migration_20260506_205114_block_presets.up,
    down: migration_20260506_205114_block_presets.down,
    name: '20260506_205114_block_presets',
  },
  {
    up: migration_20260509_media_tenant_filename_unique.up,
    down: migration_20260509_media_tenant_filename_unique.down,
    name: '20260509_media_tenant_filename_unique',
  },
  {
    up: migration_20260509_pages_tenant_slug_unique.up,
    down: migration_20260509_pages_tenant_slug_unique.down,
    name: '20260509_pages_tenant_slug_unique',
  },
  {
    up: migration_20260509_site_settings_tenant_unique.up,
    down: migration_20260509_site_settings_tenant_unique.down,
    name: '20260509_site_settings_tenant_unique',
  },
  {
    up: migration_20260513_173542_add_tenant_site_manifest.up,
    down: migration_20260513_173542_add_tenant_site_manifest.down,
    name: '20260513_173542_add_tenant_site_manifest',
  },
  {
    up: migration_20260513_180426_rt_v2_fields.up,
    down: migration_20260513_180426_rt_v2_fields.down,
    name: '20260513_180426_rt_v2_fields',
  },
  {
    up: migration_20260514_001339_add_user_editor_mode.up,
    down: migration_20260514_001339_add_user_editor_mode.down,
    name: '20260514_001339_add_user_editor_mode',
  },
  {
    up: migration_20260514_155511_add_hero_pills_cta_eyebrow.up,
    down: migration_20260514_155511_add_hero_pills_cta_eyebrow.down,
    name: '20260514_155511_add_hero_pills_cta_eyebrow',
  },
  {
    up: migration_20260514_174118_narrow_editor_mode.up,
    down: migration_20260514_174118_narrow_editor_mode.down,
    name: '20260514_174118_narrow_editor_mode',
  },
  {
    up: migration_20260514_181246_add_tenant_theme.up,
    down: migration_20260514_181246_add_tenant_theme.down,
    name: '20260514_181246_add_tenant_theme',
  },
  {
    up: migration_20260515_134310_round4_theme_roles_dark.up,
    down: migration_20260515_134310_round4_theme_roles_dark.down,
    name: '20260515_134310_round4_theme_roles_dark',
  },
  {
    up: migration_20260518_074235_add_block_anchors.up,
    down: migration_20260518_074235_add_block_anchors.down,
    name: '20260518_074235_add_block_anchors',
  },
  {
    up: migration_20260519_220324_nav_restructure.up,
    down: migration_20260519_220324_nav_restructure.down,
    name: '20260519_220324_nav_restructure',
  },
  {
    up: migration_20260520_061420_drop_rt_field_required.up,
    down: migration_20260520_061420_drop_rt_field_required.down,
    name: '20260520_061420_drop_rt_field_required',
  },
  {
    up: migration_20260520_170754_add_contact_submit_label.up,
    down: migration_20260520_170754_add_contact_submit_label.down,
    name: '20260520_170754_add_contact_submit_label',
  },
  {
    up: migration_20260522_083500_media_filename_compound_index.up,
    down: migration_20260522_083500_media_filename_compound_index.down,
    name: '20260522_083500_media_filename_compound_index',
  },
  {
    up: migration_20260525_205316_add_user_language.up,
    down: migration_20260525_205316_add_user_language.down,
    name: '20260525_205316_add_user_language',
  },
  {
    up: migration_20260526_073543_add_site_settings_chrome_maintenance.up,
    down: migration_20260526_073543_add_site_settings_chrome_maintenance.down,
    name: '20260526_073543_add_site_settings_chrome_maintenance',
  },
  {
    up: migration_20260526_081627_remove_unsupported_site_chrome_fields.up,
    down: migration_20260526_081627_remove_unsupported_site_chrome_fields.down,
    name: '20260526_081627_remove_unsupported_site_chrome_fields',
  },
  {
    up: migration_20260526_100840_add_site_settings_business_ids.up,
    down: migration_20260526_100840_add_site_settings_business_ids.down,
    name: '20260526_100840_add_site_settings_business_ids',
  },
  {
    up: migration_20260527_175609_add_site_chrome_logo_overrides.up,
    down: migration_20260527_175609_add_site_chrome_logo_overrides.down,
    name: '20260527_175609_add_site_chrome_logo_overrides',
  },
  {
    up: migration_20260527_194417_add_footer_composition_columns.up,
    down: migration_20260527_194417_add_footer_composition_columns.down,
    name: '20260527_194417_add_footer_composition_columns',
  },
  {
    up: migration_20260602_111601_add_cta_background_image.up,
    down: migration_20260602_111601_add_cta_background_image.down,
    name: '20260602_111601_add_cta_background_image',
  },
  {
    up: migration_20260602_121112_make_cta_primary_optional.up,
    down: migration_20260602_121112_make_cta_primary_optional.down,
    name: '20260602_121112_make_cta_primary_optional',
  },
  {
    up: migration_20260611_010713_add_better_auth_tables.up,
    down: migration_20260611_010713_add_better_auth_tables.down,
    name: '20260611_010713_add_better_auth_tables',
  },
  {
    up: migration_20260625_163925_add_intake_generation_runs.up,
    down: migration_20260625_163925_add_intake_generation_runs.down,
    name: '20260625_163925_add_intake_generation_runs',
  },
  {
    up: migration_20260625_190000_add_ai_generation_run_metadata.up,
    down: migration_20260625_190000_add_ai_generation_run_metadata.down,
    name: '20260625_190000_add_ai_generation_run_metadata',
  },
  {
    up: migration_20260625_210000_add_preview_approval_state.up,
    down: migration_20260625_210000_add_preview_approval_state.down,
    name: '20260625_210000_add_preview_approval_state',
  },
  {
    up: migration_20260625_230000_add_published_site_snapshots.up,
    down: migration_20260625_230000_add_published_site_snapshots.down,
    name: '20260625_230000_add_published_site_snapshots',
  },
  {
    up: migration_20260626_120000_add_preview_access_grants.up,
    down: migration_20260626_120000_add_preview_access_grants.down,
    name: '20260626_120000_add_preview_access_grants',
  },
  {
    up: migration_20260627_120000_add_concrete_block_model_schema.up,
    down: migration_20260627_120000_add_concrete_block_model_schema.down,
    name: '20260627_120000_add_concrete_block_model_schema'
  },
  {
    up: migration_20260627_130000_add_marketing_catalog_cms_schema.up,
    down: migration_20260627_130000_add_marketing_catalog_cms_schema.down,
    name: '20260627_130000_add_marketing_catalog_cms_schema'
  },
  {
    up: migration_20260627_140000_add_tenant_chrome_variant_enum_values.up,
    down: migration_20260627_140000_add_tenant_chrome_variant_enum_values.down,
    name: '20260627_140000_add_tenant_chrome_variant_enum_values'
  },
];
