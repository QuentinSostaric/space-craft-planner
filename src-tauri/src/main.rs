#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(target_os = "linux")]
mod linux_fonts;

fn main() {
    #[cfg(target_os = "linux")]
    linux_fonts::configure();

    item_fabricator_lib::run();
}
