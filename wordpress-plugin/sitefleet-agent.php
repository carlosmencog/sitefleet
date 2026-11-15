<?php
/**
 * Plugin Name: SiteFleet Agent
 * Description: Sends a signed WordPress inventory to SiteFleet.
 * Version: 0.1.0
 * Requires at least: 6.0
 * Requires PHP: 8.1
 */

defined( 'ABSPATH' ) || exit;

final class SiteFleet_Agent {
    const OPTION = 'sitefleet_agent_credentials';
    const SETTINGS = 'sitefleet_agent_settings';
    const CRON_HOOK = 'sitefleet_agent_send_inventory';

    public static function init() {
        add_action( 'admin_menu', array( __CLASS__, 'menu' ) );
        add_action( 'admin_post_sitefleet_agent_connect', array( __CLASS__, 'connect' ) );
        add_action( self::CRON_HOOK, array( __CLASS__, 'send_inventory' ) );
    }

    public static function activate() {
        if ( ! wp_next_scheduled( self::CRON_HOOK ) ) {
            wp_schedule_event( time() + HOUR_IN_SECONDS, 'twicedaily', self::CRON_HOOK );
        }
    }

    public static function deactivate() { wp_clear_scheduled_hook( self::CRON_HOOK ); }

    public static function menu() { add_management_page( 'SiteFleet Agent', 'SiteFleet Agent', 'manage_options', 'sitefleet-agent', array( __CLASS__, 'page' ) ); }

    public static function page() {
        if ( ! current_user_can( 'manage_options' ) ) { return; }
        $connected = get_option( self::OPTION );
        ?>
        <div class="wrap"><h1>SiteFleet Agent</h1>
        <?php if ( $connected ) : ?>
            <p><strong>Connected.</strong> Site ID: <?php echo esc_html( $connected['site_id'] ); ?></p>
            <p>The inventory is sent twice daily. Secrets are not displayed.</p>
        <?php else : ?>
            <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
                <?php wp_nonce_field( 'sitefleet_agent_connect' ); ?>
                <input type="hidden" name="action" value="sitefleet_agent_connect" />
                <p><label>SiteFleet API URL<br /><input required class="regular-text" type="url" name="api_url" placeholder="https://api.sitefleet.example" /></label></p>
                <p><label>Registration token<br /><input required class="regular-text" type="password" name="registration_token" autocomplete="off" /></label></p>
                <?php submit_button( 'Connect SiteFleet' ); ?>
            </form>
        <?php endif; ?></div>
        <?php
    }

    public static function connect() {
        if ( ! current_user_can( 'manage_options' ) ) { wp_die( 'Unauthorized', 403 ); }
        check_admin_referer( 'sitefleet_agent_connect' );
        $api_url = esc_url_raw( untrailingslashit( wp_unslash( $_POST['api_url'] ?? '' ) ) );
        $token = sanitize_text_field( wp_unslash( $_POST['registration_token'] ?? '' ) );
        if ( ! wp_http_validate_url( $api_url ) || strlen( $token ) < 16 ) { wp_safe_redirect( admin_url( 'tools.php?page=sitefleet-agent' ) ); exit; }
        $response = wp_remote_post( $api_url . '/v1/agent/register', array( 'timeout' => 15, 'headers' => array( 'Content-Type' => 'application/json' ), 'body' => wp_json_encode( array( 'siteUrl' => home_url(), 'registrationToken' => $token ) ) ) );
        if ( is_wp_error( $response ) || 201 !== wp_remote_retrieve_response_code( $response ) ) { wp_die( 'Could not connect SiteFleet. Check the API URL and registration token.' ); }
        $body = json_decode( wp_remote_retrieve_body( $response ), true );
        if ( empty( $body['agentId'] ) || empty( $body['agentSecret'] ) || empty( $body['siteId'] ) ) { wp_die( 'Unexpected registration response.' ); }
        update_option( self::OPTION, array( 'agent_id' => sanitize_text_field( $body['agentId'] ), 'site_id' => sanitize_text_field( $body['siteId'] ), 'secret' => sanitize_text_field( $body['agentSecret'] ) ), false );
        update_option( self::SETTINGS, array( 'api_url' => $api_url ), false );
        self::send_inventory();
        wp_safe_redirect( admin_url( 'tools.php?page=sitefleet-agent' ) ); exit;
    }

    public static function send_inventory() {
        $credentials = get_option( self::OPTION ); $settings = get_option( self::SETTINGS );
        if ( empty( $credentials['agent_id'] ) || empty( $credentials['secret'] ) || empty( $settings['api_url'] ) ) { return; }
        if ( ! function_exists( 'get_plugins' ) ) { require_once ABSPATH . 'wp-admin/includes/plugin.php'; }
        $updates = get_site_transient( 'update_plugins' );
        $plugins = array(); foreach ( get_plugins() as $file => $plugin ) { $plugins[] = array( 'slug' => $file, 'version' => $plugin['Version'], 'updateAvailable' => isset( $updates->response[ $file ] ) ); }
        $themes = array(); foreach ( wp_get_themes() as $slug => $theme ) { $themes[] = array( 'slug' => $slug, 'version' => $theme->get( 'Version' ), 'updateAvailable' => false ); }
        $payload = array( 'wordpressVersion' => get_bloginfo( 'version' ), 'phpVersion' => PHP_VERSION, 'plugins' => $plugins, 'themes' => $themes, 'collectedAt' => gmdate( 'c' ) );
        $raw = wp_json_encode( $payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ); $timestamp = (string) time();
        $signature = hash_hmac( 'sha256', "POST\n/v1/agent/inventory\n{$timestamp}\n{$raw}", $credentials['secret'] );
        wp_remote_post( $settings['api_url'] . '/v1/agent/inventory', array( 'timeout' => 20, 'headers' => array( 'Content-Type' => 'application/json', 'X-SiteFleet-Agent-Id' => $credentials['agent_id'], 'X-SiteFleet-Timestamp' => $timestamp, 'X-SiteFleet-Signature' => $signature, 'Idempotency-Key' => wp_generate_uuid4() ), 'body' => $raw ) );
    }
}

register_activation_hook( __FILE__, array( 'SiteFleet_Agent', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'SiteFleet_Agent', 'deactivate' ) );
SiteFleet_Agent::init();
