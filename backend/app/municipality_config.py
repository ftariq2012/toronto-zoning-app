MUNICIPALITY_CONFIG = {
    "toronto": {
        "id": "toronto",
        "name": "Toronto",
        "province": "ON",
        "source_name": "City of Toronto Zoning By-law Open Data",
        "source_url": "https://open.toronto.ca/dataset/zoning-by-law/",
        # Compatibility table names for the current local database. These can be
        # renamed to toronto_* tables in a later migration without touching routes.
        "tables": {
            "zoning_area": "zoning_area",
            "height_overlay": "zoning_height_overlay",
            "lot_coverage_overlay": "zoning_lot_coverage_overlay",
            "parking_overlay": "parking_zone_overlay",
            "building_setback_overlay": "zoning_building_setback_overlay",
            "policy_area_overlay": "zoning_policy_area_overlay",
            "policy_road_overlay": "zoning_policy_road_overlay",
            "priority_retail_overlay": "zoning_priority_retail_street_overlay",
            "rooming_house_overlay": "zoning_rooming_house_overlay",
            "address_points": "address_points",
        },
    },
    "brampton": {
        "id": "brampton",
        "name": "Brampton",
        "province": "ON",
        "source_name": "City of Brampton Zoning By-law 270-2004",
        "source_url": "https://www.brampton.ca/EN/residents/Building-Permits/Zoning",
        "external_sources": {
            "zoning_geojson": "https://mapsdev.brampton.ca/arcgis/rest/services/COB/Zoning_New/MapServer/6/query",
            "address_lookup": "https://mapsdev.brampton.ca/arcgis/rest/services/COB/Zoning_New/MapServer/7/query",
            "address_geocoder": "https://mapsdev.brampton.ca/arcgis/rest/services/Geocoders/COMPOSITE_SEARCH_DEV/GeocodeServer/findAddressCandidates",
            "height_overlay": "https://mapsuat.brampton.ca/arcgis/rest/services/Zoning_Review/CZBL_Draft_3/MapServer/2/query",
            "density_overlay": "https://mapsuat.brampton.ca/arcgis/rest/services/Zoning_Review/CZBL_Draft_3/MapServer/3/query",
            "lot_width_overlay": "https://mapsuat.brampton.ca/arcgis/rest/services/Zoning_Review/CZBL_Draft_3/MapServer/4/query",
            "parking_overlay": "https://mapsuat.brampton.ca/arcgis/rest/services/Zoning_Review/CZBL_Draft_3/MapServer/7/query",
            "driveway_overlay": "https://mapsuat.brampton.ca/arcgis/rest/services/Zoning_Review/CZBL_Draft_3/MapServer/12/query",
        },
    },
}


def public_municipalities():
    return [
        {
            "id": config["id"],
            "name": config["name"],
            "province": config["province"],
            "source_name": config["source_name"],
            "source_url": config["source_url"],
        }
        for config in MUNICIPALITY_CONFIG.values()
    ]
