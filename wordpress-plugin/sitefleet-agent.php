<?php
/**
 * Plugin Name: SiteFleet Agent
 * Description: Securely sends a signed WordPress inventory to SiteFleet.
 * Version: 0.3.0
 * Requires at least: 6.0
 * Requires PHP: 8.1
 */

defined( 'ABSPATH' ) || exit;

final class SiteFleet_Agent {
    const OPTION = 'sitefleet_agent_credentials';
    const SETTINGS = 'sitefleet_agent_settings';
    const STATUS = 'sitefleet_agent_status';
    const CRON_HOOK = 'sitefleet_agent_send_inventory';
    const MIN_TOKEN_LENGTH = 32;

    public static function init() {
        add_action( 'admin_menu', array( __CLASS__, 'menu' ) );
        add_action( 'admin_bar_menu', array( __CLASS__, 'admin_bar' ), 100 );
        add_action( 'admin_notices', array( __CLASS__, 'admin_notices' ) );
        add_action( 'admin_post_sitefleet_agent_connect', array( __CLASS__, 'connect' ) );
        add_action( 'admin_post_sitefleet_agent_send_inventory', array( __CLASS__, 'send_inventory_now' ) );
        add_action( self::CRON_HOOK, array( __CLASS__, 'send_inventory' ) );
    }

    public static function activate() {
        if ( ! wp_next_scheduled( self::CRON_HOOK ) ) wp_schedule_event( time() + HOUR_IN_SECONDS, 'twicedaily', self::CRON_HOOK );
    }
    public static function deactivate() { wp_clear_scheduled_hook( self::CRON_HOOK ); }
    public static function menu() { add_management_page( 'SiteFleet Agent', 'SiteFleet Agent', 'manage_options', 'sitefleet-agent', array( __CLASS__, 'page' ) ); }

    public static function admin_bar( $admin_bar ) {
        if ( ! current_user_can( 'manage_options' ) || ! self::credentials() ) return;
        $current_url = isset( $_SERVER['REQUEST_URI'] ) ? wp_validate_redirect( home_url( wp_unslash( $_SERVER['REQUEST_URI'] ) ), admin_url() ) : admin_url();
        $admin_bar->add_node( array(
            'id' => 'sitefleet-update', 'title' => 'Update SiteFleet',
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
            'inventory_failed' => array( 'error', 'The inventory could not be sent. Check the SiteFleet connection and try again.' ),
            'invalid' => array( 'error', 'Could not connect. Use a valid HTTPS API URL and an active enrollment token.' ),
            'unauthorized' => array( 'error', 'The enrollment token is invalid, expired, or already used.' ),
            'already_connected' => array( 'error', 'This site is already connected to SiteFleet. Use the existing agent or contact the workspace owner.' ),
            'failed' => array( 'error', 'Could not connect to SiteFleet. Check the API URL and service status.' ),
            'unexpected' => array( 'error', 'SiteFleet returned unexpected data. Check the API logs.' ),
        );
        if ( isset( $messages[ $notice ] ) ) {
            list( $type, $message ) = $messages[ $notice ];
            printf( '<div class="notice notice-%1$s is-dismissible"><p><strong>%2$s</strong></p></div>', esc_attr( $type ), esc_html( $message ) );
        }
    }

    public static function page() {
        if ( ! current_user_can( 'manage_options' ) ) return;
        $credentials = self::credentials(); $settings = self::settings(); $status = get_option( self::STATUS, array() );
        ?>
        <div class="wrap"><h1>SiteFleet Agent</h1>
        <?php if ( $credentials ) : ?>
            <p><strong>Connected.</strong> This site has a unique SiteFleet agent.</p>
            <table class="widefat striped" style="max-width:760px;margin:20px 0"><tbody>
                <tr><th scope="row">API endpoint</th><td><?php echo esc_html( $settings['api_url'] ?? '' ); ?></td></tr>
                <tr><th scope="row">Site ID</th><td><code><?php echo esc_html( $credentials['site_id'] ); ?></code></td></tr>
                <tr><th scope="row">Last successful inventory</th><td><?php echo ! empty( $status['last_success_at'] ) ? esc_html( $status['last_success_at'] ) . ' UTC' : 'Not sent yet'; ?></td></tr>
            </tbody></table>
            <p>The agent sends inventory twice daily. Its secret is stored locally and is never displayed.</p>
            <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
                <?php wp_nonce_field( 'sitefleet_agent_send_inventory' ); ?><input type="hidden" name="action" value="sitefleet_agent_send_inventory" />
                <?php submit_button( 'Update SiteFleet', 'secondary', 'submit', false ); ?>
            </form>
        <?php else : ?>
            <p>Connect this production site using an HTTPS SiteFleet endpoint and a single-use enrollment token.</p>
            <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
                <?php wp_nonce_field( 'sitefleet_agent_connect' ); ?><input type="hidden" name="action" value="sitefleet_agent_connect" />
                <p><label for="sitefleet-api-url"><strong>SiteFleet API URL</strong></label><br />
                    <input id="sitefleet-api-url" required class="regular-text" type="url" name="api_url" value="<?php echo esc_attr( $settings['api_url'] ?? ( defined( 'SITEFLEET_API_URL' ) ? SITEFLEET_API_URL : '' ) ); ?>" placeholder="https://api.example.com" aria-describedby="sitefleet-api-help" />
                    <span id="sitefleet-api-help" class="description">HTTPS is required outside local development.</span></p>
                <p><label for="sitefleet-registration-token"><strong>Enrollment token</strong></label><br />
                    <input id="sitefleet-registration-token" required class="regular-text" type="password" name="registration_token" autocomplete="one-time-code" aria-describedby="sitefleet-token-help" />
                    <span id="sitefleet-token-help" class="description">This token can be used once and is not stored after connection.</span></p>
                <?php submit_button( 'Connect SiteFleet' ); ?>
            </form>
        <?php endif; ?></div>
        <?php
    }

    public static function connect() {
        if ( ! current_user_can( 'manage_options' ) ) wp_die( 'Unauthorized', 403 );
        check_admin_referer( 'sitefleet_agent_connect' );
        $api_url = self::normalize_api_url( wp_unslash( $_POST['api_url'] ?? '' ) );
        $token = trim( (string) wp_unslash( $_POST['registration_token'] ?? '' ) );
        if ( ! $api_url || ! preg_match( '/^[A-Za-z0-9_-]{' . self::MIN_TOKEN_LENGTH . ',}$/', $token ) ) self::redirect( 'invalid' );
        $response = self::request( $api_url . '/v1/agent/register', array( 'siteUrl' => home_url(), 'registrationToken' => $token ), 15 );
        if ( is_wp_error( $response ) ) self::redirect( 'failed' );
        $status_code = wp_remote_retrieve_response_code( $response );
        if ( 401 === $status_code ) self::redirect( 'unauthorized' );
        if ( 409 === $status_code ) self::redirect( 'already_connected' );
        if ( 201 !== $status_code ) self::redirect( 'failed' );
        $body = json_decode( wp_remote_retrieve_body( $response ), true );
        if ( empty( $body['agentId'] ) || empty( $body['agentSecret'] ) || empty( $body['siteId'] ) ) self::redirect( 'unexpected' );
        update_option( self::OPTION, array( 'agent_id' => sanitize_text_field( $body['agentId'] ), 'site_id' => sanitize_text_field( $body['siteId'] ), 'secret' => sanitize_text_field( $body['agentSecret'] ) ), false );
        update_option( self::SETTINGS, array( 'api_url' => $api_url ), false );
        self::redirect( self::send_inventory() ? 'connected' : 'connected_inventory_failed' );
    }

    public static function send_inventory_now() {
        if ( ! current_user_can( 'manage_options' ) ) wp_die( 'Unauthorized', 403 );
        check_admin_referer( 'sitefleet_agent_send_inventory' );
        $redirect_to = wp_validate_redirect( wp_unslash( $_REQUEST['redirect_to'] ?? '' ), admin_url( 'tools.php?page=sitefleet-agent' ) );
        self::redirect( self::send_inventory() ? 'inventory_sent' : 'inventory_failed', $redirect_to );
    }

    private static function redirect( $notice, $destination = '' ) { wp_safe_redirect( add_query_arg( 'sitefleet_notice', $notice, $destination ? $destination : admin_url( 'tools.php?page=sitefleet-agent' ) ) ); exit; }
    private static function credentials() { $value = get_option( self::OPTION, array() ); return is_array( $value ) && ! empty( $value['agent_id'] ) && ! empty( $value['site_id'] ) && ! empty( $value['secret'] ) ? $value : false; }
    private static function settings() { $value = get_option( self::SETTINGS, array() ); return is_array( $value ) ? $value : array(); }

    private static function normalize_api_url( $url ) {
        $url = esc_url_raw( untrailingslashit( trim( (string) $url ) ) ); $host = wp_parse_url( $url, PHP_URL_HOST ); $scheme = wp_parse_url( $url, PHP_URL_SCHEME );
        if ( ! $host || ! $scheme ) return false;
        $is_local = in_array( $host, array( 'localhost', '127.0.0.1', 'host.docker.internal' ), true );
        if ( $is_local ) return in_array( wp_get_environment_type(), array( 'local', 'development' ), true ) && 'http' === $scheme ? $url : false;
        return 'https' === $scheme && wp_http_validate_url( $url ) ? $url : false;
    }

    private static function request( $url, $body, $timeout ) {
        return wp_remote_post( $url, array( 'timeout' => $timeout, 'redirection' => 0, 'sslverify' => true, 'reject_unsafe_urls' => true, 'headers' => array( 'Content-Type' => 'application/json', 'User-Agent' => 'SiteFleet-Agent/' . self::version() . '; ' . home_url() ), 'body' => wp_json_encode( $body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) ) );
    }

    public static function send_inventory() {
        $credentials = self::credentials(); $settings = self::settings();
        if ( ! $credentials || empty( $settings['api_url'] ) ) return false;
        if ( ! function_exists( 'get_plugins' ) ) require_once ABSPATH . 'wp-admin/includes/plugin.php';
        $updates = get_site_transient( 'update_plugins' ); $plugins = array();
        foreach ( get_plugins() as $file => $plugin ) $plugins[] = array( 'slug' => $file, 'version' => $plugin['Version'], 'updateAvailable' => isset( $updates->response[ $file ] ) );
        $themes = array(); foreach ( wp_get_themes() as $slug => $theme ) $themes[] = array( 'slug' => $slug, 'version' => $theme->get( 'Version' ), 'updateAvailable' => false );
        $payload = array( 'wordpressVersion' => get_bloginfo( 'version' ), 'phpVersion' => PHP_VERSION, 'plugins' => $plugins, 'themes' => $themes, 'collectedAt' => gmdate( 'c' ) );
        $raw = wp_json_encode( $payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ); $timestamp = (string) time();
        $signature = hash_hmac( 'sha256', "POST\n/v1/agent/inventory\n{$timestamp}\n{$raw}", $credentials['secret'] );
        $response = wp_remote_post( $settings['api_url'] . '/v1/agent/inventory', array( 'timeout' => 20, 'redirection' => 0, 'sslverify' => true, 'reject_unsafe_urls' => true, 'headers' => array( 'Content-Type' => 'application/json', 'User-Agent' => 'SiteFleet-Agent/' . self::version() . '; ' . home_url(), 'X-SiteFleet-Agent-Id' => $credentials['agent_id'], 'X-SiteFleet-Timestamp' => $timestamp, 'X-SiteFleet-Signature' => $signature, 'Idempotency-Key' => wp_generate_uuid4() ), 'body' => $raw ) );
        $status_code = is_wp_error( $response ) ? 0 : wp_remote_retrieve_response_code( $response );
        if ( ! in_array( $status_code, array( 200, 202 ), true ) ) { update_option( self::STATUS, array( 'last_failure_at' => gmdate( 'Y-m-d H:i:s' ), 'last_status_code' => $status_code ), false ); error_log( '[SiteFleet Agent] Inventory failed with HTTP ' . $status_code ); return false; }
        update_option( self::STATUS, array( 'last_success_at' => gmdate( 'Y-m-d H:i:s' ), 'last_status_code' => $status_code ), false ); return true;
    }

    private static function version() { return '0.3.0'; }
}

register_activation_hook( __FILE__, array( 'SiteFleet_Agent', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'SiteFleet_Agent', 'deactivate' ) );
SiteFleet_Agent::init();
