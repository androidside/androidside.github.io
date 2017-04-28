<?php
/* @package Joomla
 * @copyright Copyright (C) Open Source Matters. All rights reserved.
 * @license http://www.gnu.org/copyleft/gpl.html GNU/GPL, see LICENSE.php
 * @extension Phoca Extension
 * @copyright Copyright (C) Jan Pavelka www.phoca.cz
 * @license http://www.gnu.org/copyleft/gpl.html GNU/GPL
 */
defined( '_JEXEC' ) or die( 'Restricted access' );
jimport( 'joomla.plugin.plugin' );

class plgSystemPhocaCssFlagsHeight extends JPlugin
{	
	
	public function __construct(& $subject, $config) {
		parent::__construct($subject, $config);
	}
	
	function onBeforeRender() {
		
		$app 	= JFactory::getApplication();
		if ($app->getName() != 'site') { return true;}
		
		$format = $app->input->get('format', '', 'string');
		if ($format == 'feed') { return true;}
		
		/*$option = $app->input->get('option', '', 'string');
		if ($option != 'com_content') { return true;}
		
		$view = $app->input->get('view', '', 'string');
		if ($view != 'article') { return true;}*/
		
		
		JHTML::stylesheet('plugins/system/phocacssflagsheight/phocacssflagsheight/css/style.css' );
		JHTML::stylesheet('plugins/system/phocacssflagsheight/phocacssflagsheight/css/phoca-flags.css' );
		
		//$id 		= $app->input->get('id', '', 'string');
		
		
		
		return true;
	}
}
?>