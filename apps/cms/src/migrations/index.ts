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
import * as migration_20260628_000000_generic_generation_fixture_defaults from './20260628_000000_generic_generation_fixture_defaults';
import * as migration_20260630_120000_add_intake_review_fields from './20260630_120000_add_intake_review_fields';
import * as migration_20260630_130000_default_dutch_locale from './20260630_130000_default_dutch_locale';
import * as migration_20260630_150000_add_generation_run_domain_order from './20260630_150000_add_generation_run_domain_order';
import * as migration_20260701_120000_add_mail_logs from './20260701_120000_add_mail_logs';
import * as migration_20260701_130000_add_tenant_email_sending from './20260701_130000_add_tenant_email_sending';
import * as migration_20260701_140000_add_operational_alerts from './20260701_140000_add_operational_alerts';
import * as migration_20260704_120000_design_variant_and_remove_retired_chrome from './20260704_120000_design_variant_and_remove_retired_chrome';
import * as migration_20260704_130000_remove_inactive_blocks_and_block_tokens from './20260704_130000_remove_inactive_blocks_and_block_tokens';
import * as migration_20260704_140000_normalize_published_snapshot_blocks from './20260704_140000_normalize_published_snapshot_blocks';
import * as migration_20260704_150000_add_hero_secondary_cta from './20260704_150000_add_hero_secondary_cta';
import * as migration_20260704_160000_add_provider_rich_slots from './20260704_160000_add_provider_rich_slots';
import * as migration_20260705_120000_add_tailwindplus_header_enum_value from './20260705_120000_add_tailwindplus_header_enum_value';
import * as migration_20260705_162355_add_newsletter_bento_content_blocks from './20260705_162355_add_newsletter_bento_content_blocks';
import * as migration_20260705_210000_make_logo_cloud_images_optional from './20260705_210000_make_logo_cloud_images_optional';
import * as migration_20260706_172855_add_tailwindplus_provider_slots from './20260706_172855_add_tailwindplus_provider_slots';
import * as migration_20260710_142653_legal_governance_foundation from './20260710_142653_legal_governance_foundation';
import * as migration_20260711_102515_legal_notification_deliveries from './20260711_102515_legal_notification_deliveries';
import * as migration_20260711_125450_20260711_legal_operator_events from './20260711_125450_20260711_legal_operator_events';
import * as migration_20260711_183922_20260711_notice_and_continued_use from './20260711_183922_20260711_notice_and_continued_use';
import * as migration_20260712_083723_communication_preferences_and_email_policy from './20260712_083723_communication_preferences_and_email_policy';
import * as migration_20260715_120000_migrate_shadcnui_blocks_provider from './20260715_120000_migrate_shadcnui_blocks_provider';
import * as migration_20260715_131919_shadcnui_chrome_capabilities from './20260715_131919_shadcnui_chrome_capabilities';
import * as migration_20260715_224720_provider_semantic_contracts from './20260715_224720_provider_semantic_contracts';
import * as migration_20260715_233924_provider_system_settings from './20260715_233924_provider_system_settings';
import * as migration_20260716_120000_remove_theme_density from './20260716_120000_remove_theme_density';
import * as migration_20260716_123000_remove_wrapped_density_hints from './20260716_123000_remove_wrapped_density_hints';
import * as migration_20260717_120000_consolidate_theme_presets from './20260717_120000_consolidate_theme_presets';
import * as migration_20260717_180000_remove_user_editor_mode from './20260717_180000_remove_user_editor_mode';
import * as migration_20260718_123000_backfill_public_analytics_consent from './20260718_123000_backfill_public_analytics_consent';
import * as migration_20260718_230256 from './20260718_230256';
import * as migration_20260719_103000_ensure_amicare_privacy_page from './20260719_103000_ensure_amicare_privacy_page';
import * as migration_20260719_121500_restore_missing_public_analytics_consent from './20260719_121500_restore_missing_public_analytics_consent';
import * as migration_20260726_181209_commerce_records from './20260726_181209_commerce_records';
import * as migration_20260726_191919_checkout_profile_audit from './20260726_191919_checkout_profile_audit';
import * as migration_20260726_201427_phase4_mollie_payments from './20260726_201427_phase4_mollie_payments';
import * as migration_20260726_211516_phase5_new_nl_domain from './20260726_211516_phase5_new_nl_domain';
import * as migration_20260727_094718_phase7_billing_and_domain_renewals from './20260727_094718_phase7_billing_and_domain_renewals';
import * as migration_20260727_120231_phase9_automatic_domain_migration from './20260727_120231_phase9_automatic_domain_migration';
import * as migration_20260727_142003_phase10_assisted_migration from './20260727_142003_phase10_assisted_migration';
import * as migration_20260727_145356_phase11_commerce_hardening from './20260727_145356_phase11_commerce_hardening';
import * as migration_20260727_154129_phase11_transfer_confirmation from './20260727_154129_phase11_transfer_confirmation';
import * as migration_20260728_101754_checkout_structured_names from './20260728_101754_checkout_structured_names';
import * as migration_20260728_110157_tld_renewal_correctness from './20260728_110157_tld_renewal_correctness';
import * as migration_20260728_112901_renewal_dossier_evidence from './20260728_112901_renewal_dossier_evidence';
import * as migration_20260728_113932_provider_write_failure_state from './20260728_113932_provider_write_failure_state';
import * as migration_20260728_130835_commerce_existing_domain_safety from './20260728_130835_commerce_existing_domain_safety';
import * as migration_20260728_162517_migration_checkout_secret_nullable_run from './20260728_162517_migration_checkout_secret_nullable_run';
import * as migration_20260729_134424_checkout_lifecycle_notifications from './20260729_134424_checkout_lifecycle_notifications';
import * as migration_20260729_135247_durable_live_handoff_delivery from './20260729_135247_durable_live_handoff_delivery';
import * as migration_20260729_164603_automatic_migration_sources from './20260729_164603_automatic_migration_sources';
import * as migration_20260729_180259_automatic_dnssec_migration from './20260729_180259_automatic_dnssec_migration';
import * as migration_20260729_185555_automatic_edge_routing from './20260729_185555_automatic_edge_routing';
import * as migration_20260729_195522_automatic_transfer_code_delivery from './20260729_195522_automatic_transfer_code_delivery';
import * as migration_20260729_203217 from './20260729_203217';
import * as migration_20260730_013908_automatic_source_refresh_authority from './20260730_013908_automatic_source_refresh_authority';
import * as migration_20260730_030555_cloudflare_source_oauth from './20260730_030555_cloudflare_source_oauth';
import * as migration_20260730_102220_durable_pre_commerce_routing_adoption from './20260730_102220_durable_pre_commerce_routing_adoption';
import * as migration_20260803_090830_checkout_progress_drafts from './20260803_090830_checkout_progress_drafts';
import * as migration_20260803_091129_checkout_progress_profile_draft from './20260803_091129_checkout_progress_profile_draft';
import * as migration_20260804_131545_optional_domain_query from './20260804_131545_optional_domain_query';
import * as migration_20260813_193845_sitegen_owned_blocks from './20260813_193845_sitegen_owned_blocks';
import * as migration_20260813_195131_sitegen_owned_chrome_default from './20260813_195131_sitegen_owned_chrome_default';
import * as migration_20260814_110856_20260814_131000_remove_sitegen_variants from './20260814_110856_20260814_131000_remove_sitegen_variants';
import * as migration_20260814_170117_sitegen_hero_block_set from './20260814_170117_sitegen_hero_block_set';
import * as migration_20260814_183217_remove_sitegen_hero_eyebrows from './20260814_183217_remove_sitegen_hero_eyebrows';
import * as migration_20260814_195113_sitegen_hero_designs from './20260814_195113_sitegen_hero_designs';
import * as migration_20260815_001044_migrate_baseline_hero_image_rows from './20260815_001044_migrate_baseline_hero_image_rows';
import * as migration_20260815_001045_sitegen_remove_baseline_hero_image from './20260815_001045_sitegen_remove_baseline_hero_image';
import * as migration_20260815_095535_sitegen_hero_expansion from './20260815_095535_sitegen_hero_expansion';
import * as migration_20260815_122007_remove_redundant_hero_designs from './20260815_122007_remove_redundant_hero_designs';
import * as migration_20260815_160005_sitegen_hero_highlights from './20260815_160005_sitegen_hero_highlights';
import * as migration_20260815_181808_phase29_service_highlight_media from './20260815_181808_phase29_service_highlight_media';
import * as migration_20260816_020000_replace_hero_color_image_with_abstract_angles_03 from './20260816_020000_replace_hero_color_image_with_abstract_angles_03';
import * as migration_20260818_120000_remove_retired_hero_designs from './20260818_120000_remove_retired_hero_designs';
import * as migration_20260819_094909_20260819_120000_remove_hero_abstract_angles_03 from './20260819_094909_20260819_120000_remove_hero_abstract_angles_03';
import * as migration_20260819_170500_remove_selected_hero_designs from './20260819_170500_remove_selected_hero_designs';
import * as migration_20260819_180000_remove_hero_cover_actions_add_lead_image from './20260819_180000_remove_hero_cover_actions_add_lead_image';
import * as migration_20260820_115510_service_panel_selected_copy from './20260820_115510_service_panel_selected_copy';
import * as migration_20260820_130000_hero_pattern_split_image from './20260820_130000_hero_pattern_split_image';
import * as migration_20260825_160000_sitegen_canonical_hero_and_chrome from './20260825_160000_sitegen_canonical_hero_and_chrome';
import * as migration_20260825_173000_editable_not_found_content from './20260825_173000_editable_not_found_content';
import * as migration_20260825_180000_remove_unimplemented_chrome_and_rich_text from './20260825_180000_remove_unimplemented_chrome_and_rich_text';
import * as migration_20260826_090000_sitegen_navbar_family from './20260826_090000_sitegen_navbar_family';
import * as migration_20260826_100000_remove_navbar_secondary_action from './20260826_100000_remove_navbar_secondary_action';
import * as migration_20260827_090000_services_first_variant from './20260827_090000_services_first_variant';
import * as migration_20260827_100000_cta_first_variant from './20260827_100000_cta_first_variant';
import * as migration_20260827_110000_services_second_variant from './20260827_110000_services_second_variant';
import * as migration_20260828_090000_footer_first_variant from './20260828_090000_footer_first_variant';
import * as migration_20260828_100000_cta_second_variant from './20260828_100000_cta_second_variant';
import * as migration_20260828_110000_rename_theme_background_mode from './20260828_110000_rename_theme_background_mode';
import * as migration_20260829_130000_add_sitegen_block_background_modes from './20260829_130000_add_sitegen_block_background_modes';
import * as migration_20260829_150000_sitegen_consent_01 from './20260829_150000_sitegen_consent_01';
import * as migration_20260829_170000_add_consent_categories from './20260829_170000_add_consent_categories';
import * as migration_20260830_151500_repair_published_snapshot_contract from './20260830_151500_repair_published_snapshot_contract';
import * as migration_20260830_160000_repair_tenant_privacy_snapshot from './20260830_160000_repair_tenant_privacy_snapshot';
import * as migration_20260830_163000_remove_legacy_provider_privacy_marker from './20260830_163000_remove_legacy_provider_privacy_marker';

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
    name: '20260627_120000_add_concrete_block_model_schema',
  },
  {
    up: migration_20260627_130000_add_marketing_catalog_cms_schema.up,
    down: migration_20260627_130000_add_marketing_catalog_cms_schema.down,
    name: '20260627_130000_add_marketing_catalog_cms_schema',
  },
  {
    up: migration_20260627_140000_add_tenant_chrome_variant_enum_values.up,
    down: migration_20260627_140000_add_tenant_chrome_variant_enum_values.down,
    name: '20260627_140000_add_tenant_chrome_variant_enum_values',
  },
  {
    up: migration_20260628_000000_generic_generation_fixture_defaults.up,
    down: migration_20260628_000000_generic_generation_fixture_defaults.down,
    name: '20260628_000000_generic_generation_fixture_defaults',
  },
  {
    up: migration_20260630_120000_add_intake_review_fields.up,
    down: migration_20260630_120000_add_intake_review_fields.down,
    name: '20260630_120000_add_intake_review_fields',
  },
  {
    up: migration_20260630_130000_default_dutch_locale.up,
    down: migration_20260630_130000_default_dutch_locale.down,
    name: '20260630_130000_default_dutch_locale',
  },
  {
    up: migration_20260630_150000_add_generation_run_domain_order.up,
    down: migration_20260630_150000_add_generation_run_domain_order.down,
    name: '20260630_150000_add_generation_run_domain_order',
  },
  {
    up: migration_20260701_120000_add_mail_logs.up,
    down: migration_20260701_120000_add_mail_logs.down,
    name: '20260701_120000_add_mail_logs',
  },
  {
    up: migration_20260701_130000_add_tenant_email_sending.up,
    down: migration_20260701_130000_add_tenant_email_sending.down,
    name: '20260701_130000_add_tenant_email_sending',
  },
  {
    up: migration_20260701_140000_add_operational_alerts.up,
    down: migration_20260701_140000_add_operational_alerts.down,
    name: '20260701_140000_add_operational_alerts',
  },
  {
    up: migration_20260704_120000_design_variant_and_remove_retired_chrome.up,
    down: migration_20260704_120000_design_variant_and_remove_retired_chrome.down,
    name: '20260704_120000_design_variant_and_remove_retired_chrome',
  },
  {
    up: migration_20260704_130000_remove_inactive_blocks_and_block_tokens.up,
    down: migration_20260704_130000_remove_inactive_blocks_and_block_tokens.down,
    name: '20260704_130000_remove_inactive_blocks_and_block_tokens',
  },
  {
    up: migration_20260704_140000_normalize_published_snapshot_blocks.up,
    down: migration_20260704_140000_normalize_published_snapshot_blocks.down,
    name: '20260704_140000_normalize_published_snapshot_blocks',
  },
  {
    up: migration_20260704_150000_add_hero_secondary_cta.up,
    down: migration_20260704_150000_add_hero_secondary_cta.down,
    name: '20260704_150000_add_hero_secondary_cta',
  },
  {
    up: migration_20260704_160000_add_provider_rich_slots.up,
    down: migration_20260704_160000_add_provider_rich_slots.down,
    name: '20260704_160000_add_provider_rich_slots',
  },
  {
    up: migration_20260705_120000_add_tailwindplus_header_enum_value.up,
    down: migration_20260705_120000_add_tailwindplus_header_enum_value.down,
    name: '20260705_120000_add_tailwindplus_header_enum_value',
  },
  {
    up: migration_20260705_162355_add_newsletter_bento_content_blocks.up,
    down: migration_20260705_162355_add_newsletter_bento_content_blocks.down,
    name: '20260705_162355_add_newsletter_bento_content_blocks',
  },
  {
    up: migration_20260705_210000_make_logo_cloud_images_optional.up,
    down: migration_20260705_210000_make_logo_cloud_images_optional.down,
    name: '20260705_210000_make_logo_cloud_images_optional',
  },
  {
    up: migration_20260706_172855_add_tailwindplus_provider_slots.up,
    down: migration_20260706_172855_add_tailwindplus_provider_slots.down,
    name: '20260706_172855_add_tailwindplus_provider_slots',
  },
  {
    up: migration_20260710_142653_legal_governance_foundation.up,
    down: migration_20260710_142653_legal_governance_foundation.down,
    name: '20260710_142653_legal_governance_foundation',
  },
  {
    up: migration_20260711_102515_legal_notification_deliveries.up,
    down: migration_20260711_102515_legal_notification_deliveries.down,
    name: '20260711_102515_legal_notification_deliveries',
  },
  {
    up: migration_20260711_125450_20260711_legal_operator_events.up,
    down: migration_20260711_125450_20260711_legal_operator_events.down,
    name: '20260711_125450_20260711_legal_operator_events',
  },
  {
    up: migration_20260711_183922_20260711_notice_and_continued_use.up,
    down: migration_20260711_183922_20260711_notice_and_continued_use.down,
    name: '20260711_183922_20260711_notice_and_continued_use',
  },
  {
    up: migration_20260712_083723_communication_preferences_and_email_policy.up,
    down: migration_20260712_083723_communication_preferences_and_email_policy.down,
    name: '20260712_083723_communication_preferences_and_email_policy',
  },
  {
    up: migration_20260715_120000_migrate_shadcnui_blocks_provider.up,
    down: migration_20260715_120000_migrate_shadcnui_blocks_provider.down,
    name: '20260715_120000_migrate_shadcnui_blocks_provider',
  },
  {
    up: migration_20260715_131919_shadcnui_chrome_capabilities.up,
    down: migration_20260715_131919_shadcnui_chrome_capabilities.down,
    name: '20260715_131919_shadcnui_chrome_capabilities',
  },
  {
    up: migration_20260715_224720_provider_semantic_contracts.up,
    down: migration_20260715_224720_provider_semantic_contracts.down,
    name: '20260715_224720_provider_semantic_contracts',
  },
  {
    up: migration_20260715_233924_provider_system_settings.up,
    down: migration_20260715_233924_provider_system_settings.down,
    name: '20260715_233924_provider_system_settings',
  },
  {
    up: migration_20260716_120000_remove_theme_density.up,
    down: migration_20260716_120000_remove_theme_density.down,
    name: '20260716_120000_remove_theme_density',
  },
  {
    up: migration_20260716_123000_remove_wrapped_density_hints.up,
    down: migration_20260716_123000_remove_wrapped_density_hints.down,
    name: '20260716_123000_remove_wrapped_density_hints',
  },
  {
    up: migration_20260717_120000_consolidate_theme_presets.up,
    down: migration_20260717_120000_consolidate_theme_presets.down,
    name: '20260717_120000_consolidate_theme_presets',
  },
  {
    up: migration_20260717_180000_remove_user_editor_mode.up,
    down: migration_20260717_180000_remove_user_editor_mode.down,
    name: '20260717_180000_remove_user_editor_mode',
  },
  {
    up: migration_20260718_123000_backfill_public_analytics_consent.up,
    down: migration_20260718_123000_backfill_public_analytics_consent.down,
    name: '20260718_123000_backfill_public_analytics_consent',
  },
  {
    up: migration_20260718_230256.up,
    down: migration_20260718_230256.down,
    name: '20260718_230256',
  },
  {
    up: migration_20260719_103000_ensure_amicare_privacy_page.up,
    down: migration_20260719_103000_ensure_amicare_privacy_page.down,
    name: '20260719_103000_ensure_amicare_privacy_page',
  },
  {
    up: migration_20260719_121500_restore_missing_public_analytics_consent.up,
    down: migration_20260719_121500_restore_missing_public_analytics_consent.down,
    name: '20260719_121500_restore_missing_public_analytics_consent',
  },
  {
    up: migration_20260726_181209_commerce_records.up,
    down: migration_20260726_181209_commerce_records.down,
    name: '20260726_181209_commerce_records',
  },
  {
    up: migration_20260726_191919_checkout_profile_audit.up,
    down: migration_20260726_191919_checkout_profile_audit.down,
    name: '20260726_191919_checkout_profile_audit',
  },
  {
    up: migration_20260726_201427_phase4_mollie_payments.up,
    down: migration_20260726_201427_phase4_mollie_payments.down,
    name: '20260726_201427_phase4_mollie_payments',
  },
  {
    up: migration_20260726_211516_phase5_new_nl_domain.up,
    down: migration_20260726_211516_phase5_new_nl_domain.down,
    name: '20260726_211516_phase5_new_nl_domain',
  },
  {
    up: migration_20260727_094718_phase7_billing_and_domain_renewals.up,
    down: migration_20260727_094718_phase7_billing_and_domain_renewals.down,
    name: '20260727_094718_phase7_billing_and_domain_renewals',
  },
  {
    up: migration_20260727_120231_phase9_automatic_domain_migration.up,
    down: migration_20260727_120231_phase9_automatic_domain_migration.down,
    name: '20260727_120231_phase9_automatic_domain_migration',
  },
  {
    up: migration_20260727_142003_phase10_assisted_migration.up,
    down: migration_20260727_142003_phase10_assisted_migration.down,
    name: '20260727_142003_phase10_assisted_migration',
  },
  {
    up: migration_20260727_145356_phase11_commerce_hardening.up,
    down: migration_20260727_145356_phase11_commerce_hardening.down,
    name: '20260727_145356_phase11_commerce_hardening',
  },
  {
    up: migration_20260727_154129_phase11_transfer_confirmation.up,
    down: migration_20260727_154129_phase11_transfer_confirmation.down,
    name: '20260727_154129_phase11_transfer_confirmation',
  },
  {
    up: migration_20260728_101754_checkout_structured_names.up,
    down: migration_20260728_101754_checkout_structured_names.down,
    name: '20260728_101754_checkout_structured_names',
  },
  {
    up: migration_20260728_110157_tld_renewal_correctness.up,
    down: migration_20260728_110157_tld_renewal_correctness.down,
    name: '20260728_110157_tld_renewal_correctness',
  },
  {
    up: migration_20260728_112901_renewal_dossier_evidence.up,
    down: migration_20260728_112901_renewal_dossier_evidence.down,
    name: '20260728_112901_renewal_dossier_evidence',
  },
  {
    up: migration_20260728_113932_provider_write_failure_state.up,
    down: migration_20260728_113932_provider_write_failure_state.down,
    name: '20260728_113932_provider_write_failure_state',
  },
  {
    up: migration_20260728_130835_commerce_existing_domain_safety.up,
    down: migration_20260728_130835_commerce_existing_domain_safety.down,
    name: '20260728_130835_commerce_existing_domain_safety',
  },
  {
    up: migration_20260728_162517_migration_checkout_secret_nullable_run.up,
    down: migration_20260728_162517_migration_checkout_secret_nullable_run.down,
    name: '20260728_162517_migration_checkout_secret_nullable_run',
  },
  {
    up: migration_20260729_134424_checkout_lifecycle_notifications.up,
    down: migration_20260729_134424_checkout_lifecycle_notifications.down,
    name: '20260729_134424_checkout_lifecycle_notifications',
  },
  {
    up: migration_20260729_135247_durable_live_handoff_delivery.up,
    down: migration_20260729_135247_durable_live_handoff_delivery.down,
    name: '20260729_135247_durable_live_handoff_delivery',
  },
  {
    up: migration_20260729_164603_automatic_migration_sources.up,
    down: migration_20260729_164603_automatic_migration_sources.down,
    name: '20260729_164603_automatic_migration_sources',
  },
  {
    up: migration_20260729_180259_automatic_dnssec_migration.up,
    down: migration_20260729_180259_automatic_dnssec_migration.down,
    name: '20260729_180259_automatic_dnssec_migration',
  },
  {
    up: migration_20260729_185555_automatic_edge_routing.up,
    down: migration_20260729_185555_automatic_edge_routing.down,
    name: '20260729_185555_automatic_edge_routing',
  },
  {
    up: migration_20260729_195522_automatic_transfer_code_delivery.up,
    down: migration_20260729_195522_automatic_transfer_code_delivery.down,
    name: '20260729_195522_automatic_transfer_code_delivery',
  },
  {
    up: migration_20260729_203217.up,
    down: migration_20260729_203217.down,
    name: '20260729_203217',
  },
  {
    up: migration_20260730_013908_automatic_source_refresh_authority.up,
    down: migration_20260730_013908_automatic_source_refresh_authority.down,
    name: '20260730_013908_automatic_source_refresh_authority',
  },
  {
    up: migration_20260730_030555_cloudflare_source_oauth.up,
    down: migration_20260730_030555_cloudflare_source_oauth.down,
    name: '20260730_030555_cloudflare_source_oauth',
  },
  {
    up: migration_20260730_102220_durable_pre_commerce_routing_adoption.up,
    down: migration_20260730_102220_durable_pre_commerce_routing_adoption.down,
    name: '20260730_102220_durable_pre_commerce_routing_adoption',
  },
  {
    up: migration_20260803_090830_checkout_progress_drafts.up,
    down: migration_20260803_090830_checkout_progress_drafts.down,
    name: '20260803_090830_checkout_progress_drafts',
  },
  {
    up: migration_20260803_091129_checkout_progress_profile_draft.up,
    down: migration_20260803_091129_checkout_progress_profile_draft.down,
    name: '20260803_091129_checkout_progress_profile_draft',
  },
  {
    up: migration_20260804_131545_optional_domain_query.up,
    down: migration_20260804_131545_optional_domain_query.down,
    name: '20260804_131545_optional_domain_query',
  },
  {
    up: migration_20260813_193845_sitegen_owned_blocks.up,
    down: migration_20260813_193845_sitegen_owned_blocks.down,
    name: '20260813_193845_sitegen_owned_blocks',
  },
  {
    up: migration_20260813_195131_sitegen_owned_chrome_default.up,
    down: migration_20260813_195131_sitegen_owned_chrome_default.down,
    name: '20260813_195131_sitegen_owned_chrome_default',
  },
  {
    up: migration_20260814_110856_20260814_131000_remove_sitegen_variants.up,
    down: migration_20260814_110856_20260814_131000_remove_sitegen_variants.down,
    name: '20260814_110856_20260814_131000_remove_sitegen_variants',
  },
  {
    up: migration_20260814_170117_sitegen_hero_block_set.up,
    down: migration_20260814_170117_sitegen_hero_block_set.down,
    name: '20260814_170117_sitegen_hero_block_set',
  },
  {
    up: migration_20260814_183217_remove_sitegen_hero_eyebrows.up,
    down: migration_20260814_183217_remove_sitegen_hero_eyebrows.down,
    name: '20260814_183217_remove_sitegen_hero_eyebrows',
  },
  {
    up: migration_20260814_195113_sitegen_hero_designs.up,
    down: migration_20260814_195113_sitegen_hero_designs.down,
    name: '20260814_195113_sitegen_hero_designs',
  },
  {
    up: migration_20260815_001044_migrate_baseline_hero_image_rows.up,
    down: migration_20260815_001044_migrate_baseline_hero_image_rows.down,
    name: '20260815_001044_migrate_baseline_hero_image_rows',
  },
  {
    up: migration_20260815_001045_sitegen_remove_baseline_hero_image.up,
    down: migration_20260815_001045_sitegen_remove_baseline_hero_image.down,
    name: '20260815_001045_sitegen_remove_baseline_hero_image',
  },
  {
    up: migration_20260815_095535_sitegen_hero_expansion.up,
    down: migration_20260815_095535_sitegen_hero_expansion.down,
    name: '20260815_095535_sitegen_hero_expansion',
  },
  {
    up: migration_20260815_122007_remove_redundant_hero_designs.up,
    down: migration_20260815_122007_remove_redundant_hero_designs.down,
    name: '20260815_122007_remove_redundant_hero_designs',
  },
  {
    up: migration_20260815_160005_sitegen_hero_highlights.up,
    down: migration_20260815_160005_sitegen_hero_highlights.down,
    name: '20260815_160005_sitegen_hero_highlights',
  },
  {
    up: migration_20260815_181808_phase29_service_highlight_media.up,
    down: migration_20260815_181808_phase29_service_highlight_media.down,
    name: '20260815_181808_phase29_service_highlight_media',
  },
  {
    up: migration_20260816_020000_replace_hero_color_image_with_abstract_angles_03.up,
    down: migration_20260816_020000_replace_hero_color_image_with_abstract_angles_03.down,
    name: '20260816_020000_replace_hero_color_image_with_abstract_angles_03',
  },
  {
    up: migration_20260818_120000_remove_retired_hero_designs.up,
    down: migration_20260818_120000_remove_retired_hero_designs.down,
    name: '20260818_120000_remove_retired_hero_designs',
  },
  {
    up: migration_20260819_094909_20260819_120000_remove_hero_abstract_angles_03.up,
    down: migration_20260819_094909_20260819_120000_remove_hero_abstract_angles_03.down,
    name: '20260819_094909_20260819_120000_remove_hero_abstract_angles_03',
  },
  {
    up: migration_20260819_170500_remove_selected_hero_designs.up,
    down: migration_20260819_170500_remove_selected_hero_designs.down,
    name: '20260819_170500_remove_selected_hero_designs',
  },
  {
    up: migration_20260819_180000_remove_hero_cover_actions_add_lead_image.up,
    down: migration_20260819_180000_remove_hero_cover_actions_add_lead_image.down,
    name: '20260819_180000_remove_hero_cover_actions_add_lead_image',
  },
  {
    up: migration_20260820_115510_service_panel_selected_copy.up,
    down: migration_20260820_115510_service_panel_selected_copy.down,
    name: '20260820_115510_service_panel_selected_copy'
  },
  {
    up: migration_20260820_130000_hero_pattern_split_image.up,
    down: migration_20260820_130000_hero_pattern_split_image.down,
    name: '20260820_130000_hero_pattern_split_image'
  },
  {
    up: migration_20260825_160000_sitegen_canonical_hero_and_chrome.up,
    down: migration_20260825_160000_sitegen_canonical_hero_and_chrome.down,
    name: '20260825_160000_sitegen_canonical_hero_and_chrome',
  },
  {
    up: migration_20260825_173000_editable_not_found_content.up,
    down: migration_20260825_173000_editable_not_found_content.down,
    name: '20260825_173000_editable_not_found_content',
  },
  {
    up: migration_20260825_180000_remove_unimplemented_chrome_and_rich_text.up,
    down: migration_20260825_180000_remove_unimplemented_chrome_and_rich_text.down,
    name: '20260825_180000_remove_unimplemented_chrome_and_rich_text',
  },
  {
    up: migration_20260826_090000_sitegen_navbar_family.up,
    down: migration_20260826_090000_sitegen_navbar_family.down,
    name: '20260826_090000_sitegen_navbar_family',
  },
  {
    up: migration_20260826_100000_remove_navbar_secondary_action.up,
    down: migration_20260826_100000_remove_navbar_secondary_action.down,
    name: '20260826_100000_remove_navbar_secondary_action',
  },
  {
    up: migration_20260827_090000_services_first_variant.up,
    down: migration_20260827_090000_services_first_variant.down,
    name: '20260827_090000_services_first_variant',
  },
  {
    up: migration_20260827_100000_cta_first_variant.up,
    down: migration_20260827_100000_cta_first_variant.down,
    name: '20260827_100000_cta_first_variant',
  },
  {
    up: migration_20260827_110000_services_second_variant.up,
    down: migration_20260827_110000_services_second_variant.down,
    name: '20260827_110000_services_second_variant',
  },
  {
    up: migration_20260828_090000_footer_first_variant.up,
    down: migration_20260828_090000_footer_first_variant.down,
    name: '20260828_090000_footer_first_variant',
  },
  {
    up: migration_20260828_100000_cta_second_variant.up,
    down: migration_20260828_100000_cta_second_variant.down,
    name: '20260828_100000_cta_second_variant',
  },
  {
    up: migration_20260828_110000_rename_theme_background_mode.up,
    down: migration_20260828_110000_rename_theme_background_mode.down,
    name: '20260828_110000_rename_theme_background_mode',
  },
  {
    up: migration_20260829_130000_add_sitegen_block_background_modes.up,
    down: migration_20260829_130000_add_sitegen_block_background_modes.down,
    name: '20260829_130000_add_sitegen_block_background_modes',
  },
  {
    up: migration_20260829_150000_sitegen_consent_01.up,
    down: migration_20260829_150000_sitegen_consent_01.down,
    name: '20260829_150000_sitegen_consent_01',
  },
  {
    up: migration_20260829_170000_add_consent_categories.up,
    down: migration_20260829_170000_add_consent_categories.down,
    name: '20260829_170000_add_consent_categories',
  },
  {
    up: migration_20260830_151500_repair_published_snapshot_contract.up,
    down: migration_20260830_151500_repair_published_snapshot_contract.down,
    name: '20260830_151500_repair_published_snapshot_contract',
  },
  {
    up: migration_20260830_160000_repair_tenant_privacy_snapshot.up,
    down: migration_20260830_160000_repair_tenant_privacy_snapshot.down,
    name: '20260830_160000_repair_tenant_privacy_snapshot',
  },
  {
    up: migration_20260830_163000_remove_legacy_provider_privacy_marker.up,
    down: migration_20260830_163000_remove_legacy_provider_privacy_marker.down,
    name: '20260830_163000_remove_legacy_provider_privacy_marker',
  },
];
