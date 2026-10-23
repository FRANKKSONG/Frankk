fn main() {
    slint_build::compile_with_config("ui/app.slint", slint_build::CompilerConfiguration::new().with_style("fluent-dark".into())).unwrap();

    // On Windows, the program carries its name and version (Properties → Details): "Esther native 0.3.0".
    if std::env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("msvc") {
        let mut res = winresource::WindowsResource::new();
        res.set("ProductName", "Esther native");
        res.set("FileDescription", &format!("Esther native {}", env!("CARGO_PKG_VERSION")));
        res.set("CompanyName", "Esther");
        res.set("OriginalFilename", &format!("esther-native-{}.exe", env!("CARGO_PKG_VERSION")));
        res.compile().expect("the program's version information");
    }
}
