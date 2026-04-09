#!/bin/bash

# Personal Knowledge Graph - Deployment Script
# Automated setup and deployment for the PKG database

set -e  # Exit on any error

# Configuration
DB_NAME="personal_knowledge_graph"
DB_USER="root"
DB_HOST="localhost"
DB_PORT="3306"
BACKUP_DIR="./backups"
LOG_FILE="./deployment.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if MySQL client is installed
    if ! command -v mysql &> /dev/null; then
        error "MySQL client is not installed. Please install MySQL client tools."
    fi
    
    # Check if mysqldump is available
    if ! command -v mysqldump &> /dev/null; then
        error "mysqldump is not available. Please install MySQL client tools."
    fi
    
    # Test MySQL connection
    if ! mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p -e "SELECT 1;" &> /dev/null; then
        error "Cannot connect to MySQL server. Please check your credentials and connection."
    fi
    
    success "Prerequisites check passed"
}

# Create backup directory
create_backup_dir() {
    log "Creating backup directory..."
    mkdir -p "$BACKUP_DIR"
    success "Backup directory created: $BACKUP_DIR"
}

# Backup existing database if it exists
backup_existing_db() {
    log "Checking for existing database..."
    
    if mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p -e "USE $DB_NAME;" 2>/dev/null; then
        log "Existing database found. Creating backup..."
        BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_backup_$(date +%Y%m%d_%H%M%S).sql"
        
        if mysqldump -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p \
            --single-transaction \
            --routines \
            --triggers \
            --events \
            --hex-blob \
            --default-character-set=utf8mb4 \
            "$DB_NAME" > "$BACKUP_FILE"; then
            success "Database backed up to: $BACKUP_FILE"
        else
            error "Failed to backup existing database"
        fi
    else
        log "No existing database found. Proceeding with fresh installation."
    fi
}

# Deploy database schema
deploy_schema() {
    log "Deploying database schema..."
    
    if mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p \
        --default-character-set=utf8mb4 \
        < database/setup_complete.sql; then
        success "Database schema deployed successfully"
    else
        error "Failed to deploy database schema"
    fi
}

# Deploy stored procedures
deploy_procedures() {
    log "Deploying stored procedures..."
    
    # Core procedures
    if mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p "$DB_NAME" \
        < database/procedures/01_core_procedures.sql; then
        success "Core procedures deployed"
    else
        error "Failed to deploy core procedures"
    fi
    
    # Recursive and similarity procedures
    if mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p "$DB_NAME" \
        < database/procedures/03_recursive_similarity.sql; then
        success "Recursive and similarity procedures deployed"
    else
        error "Failed to deploy recursive procedures"
    fi
    
    # Materialized views
    if mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p "$DB_NAME" \
        < database/procedures/04_materialized_views.sql; then
        success "Materialized views deployed"
    else
        error "Failed to deploy materialized views"
    fi
}

# Deploy triggers
deploy_triggers() {
    log "Deploying triggers..."
    
    if mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p "$DB_NAME" \
        < database/triggers/01_maintenance_triggers.sql; then
        success "Triggers deployed successfully"
    else
        error "Failed to deploy triggers"
    fi
}

# Load sample data (optional)
load_sample_data() {
    if [ "$1" = "--with-sample-data" ]; then
        log "Loading sample data..."
        
        if mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p "$DB_NAME" \
            < database/seeds/01_comprehensive_seed_data.sql; then
            success "Sample data loaded successfully"
        else
            error "Failed to load sample data"
        fi
    else
        log "Skipping sample data loading (use --with-sample-data to include)"
    fi
}

# Run sanity tests
run_sanity_tests() {
    log "Running sanity tests..."
    
    if mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p "$DB_NAME" \
        < database/seeds/02_sanity_tests.sql; then
        success "Sanity tests completed successfully"
    else
        warning "Some sanity tests failed. Please check the logs."
    fi
}

# Run performance tests
run_performance_tests() {
    if [ "$1" = "--with-performance-tests" ]; then
        log "Running performance tests..."
        
        if mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p "$DB_NAME" \
            < database/scripts/02_performance_tests.sql; then
            success "Performance tests completed"
        else
            warning "Performance tests encountered issues. Check logs for details."
        fi
    else
        log "Skipping performance tests (use --with-performance-tests to include)"
    fi
}

# Verify deployment
verify_deployment() {
    log "Verifying deployment..."
    
    # Check table count
    TABLE_COUNT=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p "$DB_NAME" \
        -sN -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$DB_NAME';")
    
    if [ "$TABLE_COUNT" -ge 10 ]; then
        success "Database tables created: $TABLE_COUNT"
    else
        error "Insufficient tables created: $TABLE_COUNT"
    fi
    
    # Check stored procedures
    PROC_COUNT=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p "$DB_NAME" \
        -sN -e "SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = '$DB_NAME';")
    
    if [ "$PROC_COUNT" -ge 10 ]; then
        success "Stored procedures created: $PROC_COUNT"
    else
        warning "Fewer procedures than expected: $PROC_COUNT"
    fi
    
    # Check triggers
    TRIGGER_COUNT=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p "$DB_NAME" \
        -sN -e "SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = '$DB_NAME';")
    
    if [ "$TRIGGER_COUNT" -ge 5 ]; then
        success "Triggers created: $TRIGGER_COUNT"
    else
        warning "Fewer triggers than expected: $TRIGGER_COUNT"
    fi
}

# Generate deployment report
generate_report() {
    log "Generating deployment report..."
    
    REPORT_FILE="$BACKUP_DIR/deployment_report_$(date +%Y%m%d_%H%M%S).txt"
    
    {
        echo "Personal Knowledge Graph - Deployment Report"
        echo "=========================================="
        echo "Deployment Date: $(date)"
        echo "Database Name: $DB_NAME"
        echo "Database Host: $DB_HOST:$DB_PORT"
        echo ""
        echo "Database Statistics:"
        mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p "$DB_NAME" -e "
            SELECT 
                'Tables' as Metric, 
                COUNT(*) as Value 
            FROM information_schema.tables 
            WHERE table_schema = '$DB_NAME'
            UNION ALL
            SELECT 
                'Stored Procedures', 
                COUNT(*) 
            FROM information_schema.routines 
            WHERE routine_schema = '$DB_NAME'
            UNION ALL
            SELECT 
                'Triggers', 
                COUNT(*) 
            FROM information_schema.triggers 
            WHERE trigger_schema = '$DB_NAME';"
        echo ""
        echo "Table Sizes:"
        mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p "$DB_NAME" -e "
            SELECT 
                table_name as Table,
                ROUND(data_length / 1024 / 1024, 2) as Data_MB,
                ROUND(index_length / 1024 / 1024, 2) as Index_MB
            FROM information_schema.tables 
            WHERE table_schema = '$DB_NAME'
            ORDER BY data_length DESC;"
        echo ""
        echo "Deployment completed successfully!"
    } > "$REPORT_FILE"
    
    success "Deployment report generated: $REPORT_FILE"
}

# Main deployment function
main() {
    log "Starting Personal Knowledge Graph deployment..."
    
    # Parse command line arguments
    WITH_SAMPLE_DATA=false
    WITH_PERFORMANCE_TESTS=false
    
    for arg in "$@"; do
        case $arg in
            --with-sample-data)
                WITH_SAMPLE_DATA=true
                ;;
            --with-performance-tests)
                WITH_PERFORMANCE_TESTS=true
                ;;
            --help)
                echo "Usage: $0 [options]"
                echo "Options:"
                echo "  --with-sample-data      Load sample data after deployment"
                echo "  --with-performance-tests Run performance tests after deployment"
                echo "  --help                  Show this help message"
                exit 0
                ;;
            *)
                warning "Unknown option: $arg"
                ;;
        esac
    done
    
    # Execute deployment steps
    check_prerequisites
    create_backup_dir
    backup_existing_db
    deploy_schema
    deploy_procedures
    deploy_triggers
    
    # Optional steps
    if [ "$WITH_SAMPLE_DATA" = true ]; then
        load_sample_data --with-sample-data
    fi
    
    run_sanity_tests
    
    if [ "$WITH_PERFORMANCE_TESTS" = true ]; then
        run_performance_tests --with-performance-tests
    fi
    
    verify_deployment
    generate_report
    
    success "Deployment completed successfully!"
    log "Database '$DB_NAME' is ready for use."
    log "Check the deployment report and logs for detailed information."
}

# Script entry point
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi