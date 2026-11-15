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

    public static function page() {
        if ( ! current_user_can( 'manage_options' ) ) { return; }
        $connected = get_option( self::OPTION );
        $notice = sanitize_key( wp_unslash( $_GET['sitefleet_notice'] ?? '' ) );
        ?>
        <div class="wrap"><h1>SiteFleet Agent</h1>
        <?php if ( 'connected' === $notice ) : ?>
            <div class="notice notice-success is-dismissible"><p><strong>SiteFleet conectado.</strong> El primer inventario se envió para evaluación.</p></div>
        <?php elseif ( 'connected_inventory_failed' === $notice ) : ?>
            <div class="notice notice-warning is-dismissible"><p><strong>SiteFleet se conectó, pero el primer inventario no fue aceptado.</strong> Usa “Enviar inventario ahora” después de actualizar la API.</p></div>
        <?php elseif ( 'inventory_sent' === $notice ) : ?>
            <div class="notice notice-success is-dismissible"><p><strong>Inventario enviado.</strong> SiteFleet lo está evaluando.</p></div>
        <?php elseif ( 'inventory_failed' === $notice ) : ?>
            <div class="notice notice-error is-dismissible"><p><strong>No se pudo enviar el inventario.</strong> Revisa los registros de SiteFleet.</p></div>
        <?php elseif ( 'invalid' === $notice ) : ?>
            <div class="notice notice-error is-dismissible"><p><strong>No se pudo conectar.</strong> Revisa que la URL de la API sea válida y que el token tenga al menos 16 caracteres.</p></div>
        <?php elseif ( 'failed' === $notice ) : ?>
            <div class="notice notice-error is-dismissible"><p><strong>No se pudo conectar con SiteFleet.</strong> Revisa la URL de la API, el token y que el servicio esté activo.</p></div>
        <?php elseif ( 'unexpected' === $notice ) : ?>
            <div class="notice notice-error is-dismissible"><p><strong>SiteFleet respondió con datos inesperados.</strong> Revisa los registros de la API.</p></div>
        <?php endif; ?>
        <?php if ( $connected ) : ?>
            <p><strong>Connected.</strong> Site ID: <?php echo esc_html( $connected['site_id'] ); ?></p>
            <p>The inventory is sent twice daily. Secrets are not displayed.</p>
            <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
                <?php wp_nonce_field( 'sitefleet_agent_send_inventory' ); ?>
                <input type="hidden" name="action" value="sitefleet_agent_send_inventory" />
                <?php submit_button( 'Enviar inventario ahora', 'secondary', 'submit', false ); ?>
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
        self::redirect( self::send_inventory() ? 'inventory_sent' : 'inventory_failed' );
    }

    private static function redirect( $notice ) {
        wp_safe_redirect( add_query_arg( 'sitefleet_notice', $notice, admin_url( 'tools.php?page=sitefleet-agent' ) ) );
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
