<?php
/**
 * Plugin Name: SiteFleet Agent
 * Description: Sends a signed WordPress inventory to SiteFleet.
 * Version: 0.2.0
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
        add_action( 'admin_bar_menu', array( __CLASS__, 'admin_bar' ), 100 );
        add_action( 'admin_notices', array( __CLASS__, 'admin_notices' ) );
        add_action( 'admin_post_sitefleet_agent_connect', array( __CLASS__, 'connect' ) );
        add_action( 'admin_post_sitefleet_agent_send_inventory', array( __CLASS__, 'send_inventory_now' ) );
        add_action( self::CRON_HOOK, array( __CLASS__, 'send_inventory' ) );
    }

    public static function activate() {
        if ( ! wp_next_scheduled( self::CRON_HOOK ) ) {
            wp_schedule_event( time() + HOUR_IN_SECONDS, 'twicedaily', self::CRON_HOOK );
        }
    }

    public static function deactivate() { wp_clear_scheduled_hook( self::CRON_HOOK ); }

    public static function menu() { add_management_page( 'SiteFleet Agent', 'SiteFleet Agent', 'manage_options', 'sitefleet-agent', array( __CLASS__, 'page' ) ); }

    public static function admin_bar( $admin_bar ) {
        if ( ! current_user_can( 'manage_options' ) || ! get_option( self::OPTION ) ) { return; }
        $current_url = admin_url();
        if ( isset( $_SERVER['REQUEST_URI'] ) ) {
            $current_url = wp_validate_redirect( home_url( wp_unslash( $_SERVER['REQUEST_URI'] ) ), admin_url() );
        }
        $admin_bar->add_node( array(
            'id' => 'sitefleet-update',
            'title' => 'Update SiteFleet',
            'href' => add_query_arg( array( 'action' => 'sitefleet_agent_send_inventory', '_wpnonce' => wp_create_nonce( 'sitefleet_agent_send_inventory' ), 'redirect_to' => $current_url ), admin_url( 'admin-post.php' ) ),
            'meta' => array( 'title' => 'Send a fresh inventory to SiteFleet' ),
        ) );
    }

    public static function admin_notices() {
        $notice = sanitize_key( wp_unslash( $_GET['sitefleet_notice'] ?? '' ) );
        $messages = array(
            'connected' => array( 'success', 'SiteFleet connected. The first inventory was sent for evaluation.' ),
            'connected_inventory_failed' => array( 'warning', 'SiteFleet connected, but the first inventory was not accepted. Try Update SiteFleet after checking the API.' ),
            'inventory_sent' => array( 'success', 'Inventory sent. SiteFleet is evaluating the current site state.' ),
            'inventory_failed' => array( 'error', 'The inventory could not be sent. Check the SiteFleet logs and try again.' ),
            'invalid' => array( 'error', 'Could not connect. Check the API URL and registration token.' ),
            'failed' => array( 'error', 'Could not connect to SiteFleet. Check the API URL, token, and service status.' ),
            'unexpected' => array( 'error', 'SiteFleet returned unexpected data. Check the API logs.' ),
        );
        if ( ! isset( $messages[ $notice ] ) ) { return; }
        list( $type, $message ) = $messages[ $notice ];
        printf( '<div class="notice notice-%1$s is-dismissible"><p><strong>%2$s</strong></p></div>', esc_attr( $type ), esc_html( $message ) );
    }

    public static function page() {
        if ( ! current_user_can( 'manage_options' ) ) { return; }
        $connected = get_option( self::OPTION );
        ?>
        <div class="wrap"><h1>SiteFleet Agent</h1>
        <?php if ( $connected ) : ?>
            <p><strong>Connected.</strong> Site ID: <?php echo esc_html( $connected['site_id'] ); ?></p>
            <p>The inventory is sent twice daily. Secrets are not displayed.</p>
            <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
                <?php wp_nonce_field( 'sitefleet_agent_send_inventory' ); ?>
                <input type="hidden" name="action" value="sitefleet_agent_send_inventory" />
                <?php submit_button( 'Update SiteFleet', 'secondary', 'submit', false ); ?>
            </form>
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
        if ( ! self::valid_api_url( $api_url ) || strlen( $token ) < 16 ) { self::redirect( 'invalid' ); }
        $response = wp_remote_post( $api_url . '/v1/agent/register', array( 'timeout' => 15, 'headers' => array( 'Content-Type' => 'application/json' ), 'body' => wp_json_encode( array( 'siteUrl' => home_url(), 'registrationToken' => $token ) ) ) );
        if ( is_wp_error( $response ) || 201 !== wp_remote_retrieve_response_code( $response ) ) {
            error_log( '[SiteFleet Agent] Registration failed: ' . ( is_wp_error( $response ) ? $response->get_error_message() : 'HTTP ' . wp_remote_retrieve_response_code( $response ) ) );
            self::redirect( 'failed' );
        }
        $body = json_decode( wp_remote_retrieve_body( $response ), true );
        if ( empty( $body['agentId'] ) || empty( $body['agentSecret'] ) || empty( $body['siteId'] ) ) { self::redirect( 'unexpected' ); }
        update_option( self::OPTION, array( 'agent_id' => sanitize_text_field( $body['agentId'] ), 'site_id' => sanitize_text_field( $body['siteId'] ), 'secret' => sanitize_text_field( $body['agentSecret'] ) ), false );
        update_option( self::SETTINGS, array( 'api_url' => $api_url ), false );
        self::redirect( self::send_inventory() ? 'connected' : 'connected_inventory_failed' );
    }

    public static function send_inventory_now() {
        if ( ! current_user_can( 'manage_options' ) ) { wp_die( 'Unauthorized', 403 ); }
        check_admin_referer( 'sitefleet_agent_send_inventory' );
        $redirect_to = wp_validate_redirect( wp_unslash( $_REQUEST['redirect_to'] ?? '' ), admin_url( 'tools.php?page=sitefleet-agent' ) );
        self::redirect( self::send_inventory() ? 'inventory_sent' : 'inventory_failed', $redirect_to );
    }

    private static function redirect( $notice, $destination = '' ) {
        $destination = $destination ? $destination : admin_url( 'tools.php?page=sitefleet-agent' );
        wp_safe_redirect( add_query_arg( 'sitefleet_notice', $notice, $destination ) );
        exit;
    }

    private static function valid_api_url( $url ) {
        $host = wp_parse_url( $url, PHP_URL_HOST );
        if ( in_array( $host, array( 'localhost', '127.0.0.1', 'host.docker.internal' ), true ) ) { return true; }
        return (bool) wp_http_validate_url( $url );
    }

    public static function send_inventory() {
        $credentials = get_option( self::OPTION ); $settings = get_option( self::SETTINGS );
        if ( empty( $credentials['agent_id'] ) || empty( $credentials['secret'] ) || empty( $settings['api_url'] ) ) { return false; }
        if ( ! function_exists( 'get_plugins' ) ) { require_once ABSPATH . 'wp-admin/includes/plugin.php'; }
        $updates = get_site_transient( 'update_plugins' );
        $plugins = array(); foreach ( get_plugins() as $file => $plugin ) { $plugins[] = array( 'slug' => $file, 'version' => $plugin['Version'], 'updateAvailable' => isset( $updates->response[ $file ] ) ); }
        $themes = array(); foreach ( wp_get_themes() as $slug => $theme ) { $themes[] = array( 'slug' => $slug, 'version' => $theme->get( 'Version' ), 'updateAvailable' => false ); }
        $payload = array( 'wordpressVersion' => get_bloginfo( 'version' ), 'phpVersion' => PHP_VERSION, 'plugins' => $plugins, 'themes' => $themes, 'collectedAt' => gmdate( 'c' ) );
        $raw = wp_json_encode( $payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ); $timestamp = (string) time();
        $signature = hash_hmac( 'sha256', "POST\n/v1/agent/inventory\n{$timestamp}\n{$raw}", $credentials['secret'] );
        $response = wp_remote_post( $settings['api_url'] . '/v1/agent/inventory', array( 'timeout' => 20, 'headers' => array( 'Content-Type' => 'application/json', 'X-SiteFleet-Agent-Id' => $credentials['agent_id'], 'X-SiteFleet-Timestamp' => $timestamp, 'X-SiteFleet-Signature' => $signature, 'Idempotency-Key' => wp_generate_uuid4() ), 'body' => $raw ) );
        if ( is_wp_error( $response ) || ! in_array( wp_remote_retrieve_response_code( $response ), array( 200, 202 ), true ) ) {
            error_log( '[SiteFleet Agent] Inventory failed: ' . ( is_wp_error( $response ) ? $response->get_error_message() : 'HTTP ' . wp_remote_retrieve_response_code( $response ) ) );
            return false;
        }
        return true;
    }
}

register_activation_hook( __FILE__, array( 'SiteFleet_Agent', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'SiteFleet_Agent', 'deactivate' ) );
SiteFleet_Agent::init();
